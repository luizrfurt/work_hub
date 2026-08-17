from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError, NotFoundError
from app.core.permissions import is_admin, require_admin
from app.core.uploads import validate_upload
from app.models.task import Task, TaskStatus
from app.models.task_attachment import TaskAttachment
from app.models.user import User
from app.realtime.manager import connection_manager
from app.repositories.project_repository import ProjectRepository
from app.repositories.task_repository import TaskRepository
from app.schemas.message import AttachmentPublic
from app.schemas.task import TaskCreate, TaskPublic, TaskUpdate
from app.services.project_service import ProjectService
from app.storage import storage


class TaskService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.tasks = TaskRepository(db)
        self.projects = ProjectRepository(db)
        self.project_service = ProjectService(db)

    def list_tasks(self, project_id: int, actor: User) -> list[TaskPublic]:
        self.project_service.assert_can_access(project_id, actor)
        return [self._to_public(task) for task in self.tasks.list_by_project(project_id)]

    def get_task(self, project_id: int, task_id: int, actor: User) -> TaskPublic:
        self.project_service.assert_can_access(project_id, actor)
        task = self._get_task_in_project(project_id, task_id)
        return self._to_public(task)

    def create_task(self, project_id: int, payload: TaskCreate, actor: User) -> TaskPublic:
        self.project_service.assert_can_access(project_id, actor)
        self._assert_assignee_is_member(project_id, payload.assigned_user_id)

        position = payload.position
        if position is None:
            position = self.tasks.next_position(project_id, payload.status)
        else:
            self._place_new_slot(project_id, payload.status, position)

        task = Task(
            project_id=project_id,
            title=payload.title.strip(),
            description=payload.description.strip() if payload.description else None,
            due_date=payload.due_date,
            assigned_user_id=payload.assigned_user_id,
            status=payload.status,
            position=position,
            created_by=actor.id,
        )
        self.tasks.add(task)
        self.db.commit()
        task = self.tasks.get_by_id(task.id)
        assert task is not None
        public = self._to_public(task)
        self._broadcast(project_id, public)
        return public

    def update_task(
        self, project_id: int, task_id: int, payload: TaskUpdate, actor: User
    ) -> TaskPublic:
        self.project_service.assert_can_access(project_id, actor)
        task = self._get_task_in_project(project_id, task_id)
        self._assert_can_manage(task, actor)

        if payload.title is not None:
            task.title = payload.title.strip()
        if payload.description is not None:
            task.description = payload.description.strip() or None
        if payload.due_date is not None or "due_date" in payload.model_fields_set:
            task.due_date = payload.due_date
        if payload.assigned_user_id is not None:
            self._assert_assignee_is_member(project_id, payload.assigned_user_id)
            task.assigned_user_id = payload.assigned_user_id

        moving = payload.status is not None or payload.position is not None
        affected: list[Task] = [task]
        if moving:
            target_status = payload.status if payload.status is not None else task.status
            if payload.position is None and target_status == task.status:
                pass
            else:
                affected = self._place_task(task, target_status, payload.position)

        self.db.commit()
        refreshed = [self.tasks.get_by_id(item.id) for item in affected]
        current = next(item for item in refreshed if item is not None and item.id == task.id)
        publics = [self._to_public(item) for item in refreshed if item is not None]
        if len(publics) == 1:
            self._broadcast(project_id, publics[0])
        else:
            self._broadcast_many(project_id, publics)
        return self._to_public(current)

    def delete_task(self, project_id: int, task_id: int, actor: User) -> None:
        require_admin(actor)
        self.project_service.assert_can_access(project_id, actor)
        task = self._get_task_in_project(project_id, task_id)
        status = task.status
        storage_keys = [item.storage_key for item in task.attachments or []]
        self.tasks.delete(task)
        self.db.flush()
        remaining = self.tasks.list_by_project_status(project_id, status)
        for position, item in enumerate(remaining):
            item.position = position
        self.db.commit()
        for storage_key in storage_keys:
            try:
                storage.delete(storage_key)
            except ValueError:
                continue
        self._broadcast_deleted(project_id, task_id)
        remaining = self.tasks.list_by_project_status(project_id, status)
        if remaining:
            self._broadcast_many(project_id, [self._to_public(item) for item in remaining])

    def add_attachment(
        self, project_id: int, task_id: int, actor: User, file: UploadFile
    ) -> TaskPublic:
        self.project_service.assert_can_access(project_id, actor)
        task = self._get_task_in_project(project_id, task_id)
        self._assert_can_manage(task, actor)
        data = file.file.read()
        mime_type, original_name = validate_upload(file, data)
        storage_key = f"{project_id}/{uuid4()}_{original_name}"
        storage.save(storage_key, data)
        self.tasks.add_attachment(
            TaskAttachment(
                task_id=task.id,
                original_name=original_name,
                storage_key=storage_key,
                mime_type=mime_type,
                size=len(data),
            )
        )
        self.db.commit()
        stored = self.tasks.get_by_id(task.id)
        assert stored is not None
        public = self._to_public(stored)
        self._broadcast(project_id, public)
        return public

    def get_attachment_for_download(
        self, project_id: int, task_id: int, attachment_id: int, actor: User
    ) -> TaskAttachment:
        self.project_service.assert_can_access(project_id, actor)
        attachment = self.tasks.get_attachment(attachment_id)
        if attachment is None:
            raise NotFoundError("Anexo não encontrado.")
        task = self.tasks.get_by_id(attachment.task_id)
        if task is None or task.project_id != project_id or task.id != task_id:
            raise NotFoundError("Anexo não encontrado.")
        return attachment

    def delete_attachment(
        self, project_id: int, task_id: int, attachment_id: int, actor: User
    ) -> TaskPublic:
        attachment = self.get_attachment_for_download(project_id, task_id, attachment_id, actor)
        task = self._get_task_in_project(project_id, task_id)
        self._assert_can_manage(task, actor)
        storage_key = attachment.storage_key
        self.tasks.delete_attachment(attachment)
        self.db.commit()
        try:
            storage.delete(storage_key)
        except ValueError:
            pass
        stored = self.tasks.get_by_id(task_id)
        assert stored is not None
        public = self._to_public(stored)
        self._broadcast(project_id, public)
        return public

    def _place_new_slot(self, project_id: int, status: TaskStatus, index: int) -> None:
        column = self.tasks.list_by_project_status(project_id, status)
        index = max(0, min(index, len(column)))
        for position, item in enumerate(column):
            if position >= index:
                item.position = position + 1
        self.db.flush()

    def _place_task(self, task: Task, status: TaskStatus, index: int | None) -> list[Task]:
        old_status = task.status
        origin = self.tasks.list_by_project_status(task.project_id, old_status)
        destination = (
            origin
            if old_status == status
            else self.tasks.list_by_project_status(task.project_id, status)
        )
        destination = [item for item in destination if item.id != task.id]
        if index is None:
            index = len(destination)
        index = max(0, min(index, len(destination)))

        task.status = status
        destination.insert(index, task)

        affected: list[Task] = []
        for position, item in enumerate(destination):
            item.position = position
            affected.append(item)

        if old_status != status:
            origin = [item for item in origin if item.id != task.id]
            for position, item in enumerate(origin):
                item.position = position
                affected.append(item)

        self.db.flush()
        return affected

    def _get_task_in_project(self, project_id: int, task_id: int) -> Task:
        task = self.tasks.get_by_id(task_id)
        if task is None or task.project_id != project_id:
            raise NotFoundError("Tarefa não encontrada.")
        return task

    def _assert_assignee_is_member(self, project_id: int, user_id: int) -> None:
        if not self.projects.is_member(project_id, user_id):
            raise ForbiddenError("O responsável precisa participar do projeto.")

    def _assert_can_manage(self, task: Task, actor: User) -> None:
        if is_admin(actor) or task.assigned_user_id == actor.id:
            return
        raise ForbiddenError("Somente o administrador ou o responsável podem alterar esta tarefa.")

    def _broadcast(self, project_id: int, task: TaskPublic) -> None:
        connection_manager.broadcast_nowait(
            project_id, {"type": "task", "payload": task.model_dump(mode="json")}
        )

    def _broadcast_deleted(self, project_id: int, task_id: int) -> None:
        connection_manager.broadcast_nowait(
            project_id, {"type": "task_deleted", "payload": {"id": task_id}}
        )

    def _broadcast_many(self, project_id: int, tasks: list[TaskPublic]) -> None:
        connection_manager.broadcast_nowait(
            project_id,
            {"type": "tasks", "payload": [task.model_dump(mode="json") for task in tasks]},
        )

    def _to_public(self, task: Task) -> TaskPublic:
        return TaskPublic(
            id=task.id,
            project_id=task.project_id,
            title=task.title,
            description=task.description,
            due_date=task.due_date,
            assigned_user_id=task.assigned_user_id,
            assigned_user_name=task.assigned_user.name if task.assigned_user else "",
            status=task.status,
            position=task.position,
            created_by=task.created_by,
            created_at=task.created_at,
            updated_at=task.updated_at,
            attachments=[
                AttachmentPublic(
                    id=item.id,
                    original_name=item.original_name,
                    mime_type=item.mime_type,
                    size=item.size,
                    created_at=item.created_at,
                )
                for item in task.attachments or []
            ],
        )
