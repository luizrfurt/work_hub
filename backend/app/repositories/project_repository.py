from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.project_read_state import ProjectReadState
from app.models.user import User


class ProjectRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, project_id: int) -> Project | None:
        return self.db.get(Project, project_id)

    def list_all(self) -> list[tuple[Project, int]]:
        member_count = func.count(ProjectMember.id).label("member_count")
        stmt = (
            select(Project, member_count)
            .outerjoin(ProjectMember, ProjectMember.project_id == Project.id)
            .group_by(Project.id)
            .order_by(Project.created_at.asc(), Project.id.asc())
        )
        return list(self.db.execute(stmt).all())

    def list_for_organization(self, organization_id: int) -> list[tuple[Project, int]]:
        member_count = func.count(ProjectMember.id).label("member_count")
        stmt = (
            select(Project, member_count)
            .outerjoin(ProjectMember, ProjectMember.project_id == Project.id)
            .where(Project.organization_id == organization_id)
            .group_by(Project.id)
            .order_by(Project.created_at.asc(), Project.id.asc())
        )
        return list(self.db.execute(stmt).all())

    def count_distinct_members(self) -> int:
        stmt = select(func.count(func.distinct(ProjectMember.user_id)))
        return int(self.db.execute(stmt).scalar_one() or 0)

    def count_distinct_members_for_organization(self, organization_id: int) -> int:
        stmt = (
            select(func.count(func.distinct(ProjectMember.user_id)))
            .join(Project, Project.id == ProjectMember.project_id)
            .where(Project.organization_id == organization_id)
        )
        return int(self.db.execute(stmt).scalar_one() or 0)

    def list_for_user(self, user_id: int) -> list[tuple[Project, int]]:
        member_projects = select(ProjectMember.project_id).where(ProjectMember.user_id == user_id)
        member_count = func.count(ProjectMember.id).label("member_count")
        stmt = (
            select(Project, member_count)
            .join(ProjectMember, ProjectMember.project_id == Project.id)
            .where(Project.id.in_(member_projects))
            .group_by(Project.id)
            .order_by(Project.created_at.asc(), Project.id.asc())
        )
        return list(self.db.execute(stmt).all())

    def add(self, project: Project) -> Project:
        self.db.add(project)
        self.db.flush()
        return project

    def get_membership(self, project_id: int, user_id: int) -> ProjectMember | None:
        stmt = select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def is_member(self, project_id: int, user_id: int) -> bool:
        return self.get_membership(project_id, user_id) is not None

    def list_members(self, project_id: int) -> list[tuple[ProjectMember, User]]:
        stmt = (
            select(ProjectMember, User)
            .join(User, User.id == ProjectMember.user_id)
            .where(ProjectMember.project_id == project_id)
            .order_by(User.name.asc())
        )
        return list(self.db.execute(stmt).all())

    def add_member(self, membership: ProjectMember) -> ProjectMember:
        self.db.add(membership)
        self.db.flush()
        return membership

    def remove_member(self, membership: ProjectMember) -> None:
        self.db.delete(membership)
        self.db.flush()

    def delete(self, project: Project) -> None:
        self.db.delete(project)
        self.db.flush()

    def get_read_state(self, project_id: int, user_id: int) -> ProjectReadState | None:
        stmt = select(ProjectReadState).where(
            ProjectReadState.project_id == project_id,
            ProjectReadState.user_id == user_id,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def upsert_read_state(
        self, project_id: int, user_id: int, last_read_at: datetime
    ) -> ProjectReadState:
        if last_read_at.tzinfo is None:
            last_read_at = last_read_at.replace(tzinfo=timezone.utc)
        state = self.get_read_state(project_id, user_id)
        if state is None:
            state = ProjectReadState(
                project_id=project_id,
                user_id=user_id,
                last_read_at=last_read_at,
            )
            self.db.add(state)
            self.db.flush()
            return state
        current = state.last_read_at
        if current is not None and current.tzinfo is None:
            current = current.replace(tzinfo=timezone.utc)
        if current is None or last_read_at > current:
            state.last_read_at = last_read_at
            self.db.flush()
        return state
