from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.permissions import is_admin, require_admin
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.task import TaskStatus
from app.models.user import User
from app.realtime.manager import connection_manager
from app.repositories.message_repository import MessageRepository
from app.repositories.project_repository import ProjectRepository
from app.repositories.task_repository import TaskRepository
from app.repositories.user_repository import UserRepository
from app.schemas.project import (
    OverviewContributor,
    OverviewProject,
    OverviewPublic,
    ProjectCreate,
    ProjectMemberPublic,
    ProjectPublic,
    ProjectUpdate,
    StorageUsagePublic,
)
from app.storage import storage


class ProjectService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.projects = ProjectRepository(db)
        self.users = UserRepository(db)
        self.tasks = TaskRepository(db)
        self.messages = MessageRepository(db)

    def create_project(self, payload: ProjectCreate, actor: User) -> Project:
        require_admin(actor)
        project = Project(
            organization_id=actor.organization_id,
            name=payload.name.strip(),
            description=payload.description.strip() if payload.description else None,
            created_by=actor.id,
        )
        self.projects.add(project)
        self.projects.add_member(ProjectMember(project_id=project.id, user_id=actor.id))
        self.db.commit()
        self.db.refresh(project)
        return project

    def update_project(self, project_id: int, payload: ProjectUpdate, actor: User) -> ProjectPublic:
        require_admin(actor)
        project = self._require_accessible_project(project_id, actor)
        if payload.name is not None:
            project.name = payload.name.strip()
        if "description" in payload.model_fields_set:
            project.description = payload.description.strip() if payload.description else None
        self.db.commit()
        self.db.refresh(project)
        return self.get_project(project.id, actor)

    def delete_project(self, project_id: int, actor: User) -> None:
        require_admin(actor)
        project = self._require_accessible_project(project_id, actor)
        attachment_keys = self.messages.list_attachment_keys_for_project(project.id)
        attachment_keys.extend(self.tasks.list_attachment_keys_for_project(project.id))
        self.projects.delete(project)
        self.db.commit()
        connection_manager.disconnect_room(project_id)
        for storage_key in attachment_keys:
            try:
                storage.delete(storage_key)
            except ValueError:
                continue
        try:
            storage.delete_prefix(str(project_id))
        except ValueError:
            pass

    def list_projects(self, actor: User) -> list[ProjectPublic]:
        rows = (
            self.projects.list_for_organization(actor.organization_id)
            if is_admin(actor)
            else self.projects.list_for_user(actor.id)
        )
        last_times = self.messages.last_message_times()
        unread_counts = self.messages.unread_counts_for_user(
            actor.id, [project.id for project, _count in rows]
        )
        return [
            ProjectPublic(
                id=project.id,
                name=project.name,
                description=project.description,
                created_by=project.created_by,
                member_count=count,
                last_message_at=last_times.get(project.id),
                unread_count=unread_counts.get(project.id, 0),
                created_at=project.created_at,
                updated_at=project.updated_at,
            )
            for project, count in rows
        ]

    def get_project(self, project_id: int, actor: User) -> ProjectPublic:
        project = self._require_accessible_project(project_id, actor)
        members = self.projects.list_members(project.id)
        return ProjectPublic(
            id=project.id,
            name=project.name,
            description=project.description,
            created_by=project.created_by,
            member_count=len(members),
            last_message_at=self.messages.last_message_at(project.id),
            unread_count=self.messages.unread_counts_for_user(actor.id, [project.id]).get(
                project.id, 0
            ),
            created_at=project.created_at,
            updated_at=project.updated_at,
        )

    def mark_project_read(self, project_id: int, actor: User) -> None:
        self._require_accessible_project(project_id, actor)
        self.projects.upsert_read_state(project_id, actor.id, datetime.now(timezone.utc))
        self.db.commit()

    def sync_read_states(self, last_read: dict[str, datetime], actor: User) -> None:
        for raw_id, read_at in last_read.items():
            try:
                project_id = int(raw_id)
            except (TypeError, ValueError):
                continue
            try:
                self._require_accessible_project(project_id, actor)
            except (NotFoundError, ForbiddenError):
                continue
            aware = read_at if read_at.tzinfo else read_at.replace(tzinfo=timezone.utc)
            self.projects.upsert_read_state(project_id, actor.id, aware)
        self.db.commit()

    def list_notification_user_ids(self, project_id: int) -> list[int]:
        project = self.projects.get_by_id(project_id)
        if project is None:
            return []
        ids = {user.id for _membership, user in self.projects.list_members(project_id) if user.is_active}
        ids.update(self.users.list_active_admin_ids(project.organization_id))
        return list(ids)

    def get_overview(self, actor: User) -> OverviewPublic:
        require_admin(actor)
        projects = self.projects.list_for_organization(actor.organization_id)
        by_project = self.tasks.counts_by_project()
        by_assignee = self.tasks.counts_by_assignee()

        overview_projects: list[OverviewProject] = []
        totals = {TaskStatus.TODO: 0, TaskStatus.IN_PROGRESS: 0, TaskStatus.DONE: 0}
        for project, member_count in projects:
            counts = by_project.get(project.id, {})
            item = self._task_slice(counts)
            totals[TaskStatus.TODO] += item["todo"]
            totals[TaskStatus.IN_PROGRESS] += item["in_progress"]
            totals[TaskStatus.DONE] += item["done"]
            overview_projects.append(
                OverviewProject(
                    id=project.id,
                    name=project.name,
                    member_count=member_count,
                    **item,
                )
            )

        contributors: list[OverviewContributor] = []
        if by_assignee:
            users = {
                user.id: user
                for user in self.users.list_by_organization(actor.organization_id)
            }
            for user_id, counts in by_assignee.items():
                user = users.get(user_id)
                if user is None:
                    continue
                contributors.append(
                    OverviewContributor(
                        user_id=user.id,
                        name=user.name,
                        username=user.username,
                        **self._task_slice(counts),
                    )
                )
            contributors.sort(key=lambda item: (-item.done, -item.active, item.name.lower()))

        total = sum(totals.values())
        active = totals[TaskStatus.TODO] + totals[TaskStatus.IN_PROGRESS]
        used_bytes, file_count = self._attachment_usage(actor.organization_id)
        return OverviewPublic(
            project_count=len(overview_projects),
            people_count=self.projects.count_distinct_members_for_organization(
                actor.organization_id
            ),
            todo=totals[TaskStatus.TODO],
            in_progress=totals[TaskStatus.IN_PROGRESS],
            done=totals[TaskStatus.DONE],
            active=active,
            total=total,
            storage_used_bytes=used_bytes,
            storage_quota_bytes=get_settings().storage_quota_bytes,
            storage_file_count=file_count,
            projects=overview_projects,
            contributors=contributors,
        )

    def get_storage_usage(self, actor: User) -> StorageUsagePublic:
        used_bytes, file_count = self._attachment_usage(actor.organization_id)
        return StorageUsagePublic(
            storage_used_bytes=used_bytes,
            storage_quota_bytes=get_settings().storage_quota_bytes,
            storage_file_count=file_count,
        )

    def add_member(self, project_id: int, user_id: int, actor: User) -> ProjectMemberPublic:
        require_admin(actor)
        project = self._require_accessible_project(project_id, actor)

        user = self.users.get_by_id(user_id)
        if user is None or not user.is_active or user.organization_id != actor.organization_id:
            raise NotFoundError("Usuário não encontrado.")

        membership = ProjectMember(project_id=project.id, user_id=user.id)
        try:
            self.projects.add_member(membership)
            self.db.commit()
            self.db.refresh(membership)
        except IntegrityError:
            self.db.rollback()
            raise ConflictError("Usuário já pertence a este projeto.")

        return ProjectMemberPublic(
            user_id=user.id,
            username=user.username,
            name=user.name,
            joined_at=membership.joined_at,
        )

    def remove_member(self, project_id: int, user_id: int, actor: User) -> None:
        require_admin(actor)
        project = self._require_accessible_project(project_id, actor)

        membership = self.projects.get_membership(project.id, user_id)
        if membership is None:
            raise NotFoundError("Usuário não pertence a este projeto.")

        self.projects.remove_member(membership)
        self.db.commit()
        connection_manager.disconnect_user(project.id, user_id)

    def list_members(self, project_id: int, actor: User) -> list[ProjectMemberPublic]:
        project = self._require_accessible_project(project_id, actor)
        rows = self.projects.list_members(project.id)
        return [
            ProjectMemberPublic(
                user_id=user.id,
                username=user.username,
                name=user.name,
                joined_at=membership.joined_at,
            )
            for membership, user in rows
        ]

    def assert_can_access(self, project_id: int, actor: User) -> Project:
        return self._require_accessible_project(project_id, actor)

    def assert_is_member(self, project_id: int, user_id: int) -> Project:
        project = self.projects.get_by_id(project_id)
        if project is None:
            raise NotFoundError("Projeto não encontrado.")
        if not self.projects.is_member(project_id, user_id):
            raise ForbiddenError("Você não participa deste projeto.")
        return project

    def _attachment_usage(self, organization_id: int) -> tuple[int, int]:
        used_bytes, file_count = self.messages.sum_attachment_usage_for_organization(
            organization_id
        )
        task_bytes, task_files = self.tasks.sum_attachment_usage_for_organization(
            organization_id
        )
        return used_bytes + task_bytes, file_count + task_files

    def _task_slice(self, counts: dict) -> dict[str, int]:
        todo = int(counts.get(TaskStatus.TODO, 0) or counts.get("TODO", 0))
        in_progress = int(counts.get(TaskStatus.IN_PROGRESS, 0) or counts.get("IN_PROGRESS", 0))
        done = int(counts.get(TaskStatus.DONE, 0) or counts.get("DONE", 0))
        return {
            "todo": todo,
            "in_progress": in_progress,
            "done": done,
            "active": todo + in_progress,
            "total": todo + in_progress + done,
        }

    def _require_accessible_project(self, project_id: int, actor: User) -> Project:
        project = self.projects.get_by_id(project_id)
        if project is None:
            raise NotFoundError("Projeto não encontrado.")
        if project.organization_id != actor.organization_id:
            raise NotFoundError("Projeto não encontrado.")
        if is_admin(actor):
            return project
        if not self.projects.is_member(project_id, actor.id):
            raise ForbiddenError("Você não participa deste projeto.")
        return project
