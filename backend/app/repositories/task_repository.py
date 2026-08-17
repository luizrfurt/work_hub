from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.project import Project
from app.models.task import Task, TaskStatus
from app.models.task_attachment import TaskAttachment


def _task_load_options():
    return (selectinload(Task.assigned_user), selectinload(Task.attachments))


class TaskRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, task_id: int) -> Task | None:
        stmt = select(Task).options(*_task_load_options()).where(Task.id == task_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def list_by_project(self, project_id: int) -> list[Task]:
        stmt = (
            select(Task)
            .options(*_task_load_options())
            .where(Task.project_id == project_id)
            .order_by(Task.position.asc(), Task.created_at.asc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def list_by_project_status(self, project_id: int, status: TaskStatus) -> list[Task]:
        stmt = (
            select(Task)
            .options(*_task_load_options())
            .where(Task.project_id == project_id, Task.status == status)
            .order_by(Task.position.asc(), Task.created_at.asc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def next_position(self, project_id: int, status: TaskStatus) -> int:
        stmt = select(func.coalesce(func.max(Task.position), -1)).where(
            Task.project_id == project_id,
            Task.status == status,
        )
        maximum = self.db.execute(stmt).scalar_one()
        return int(maximum) + 1

    def add(self, task: Task) -> Task:
        self.db.add(task)
        self.db.flush()
        return task

    def delete(self, task: Task) -> None:
        self.db.delete(task)

    def add_attachment(self, attachment: TaskAttachment) -> TaskAttachment:
        self.db.add(attachment)
        self.db.flush()
        return attachment

    def get_attachment(self, attachment_id: int) -> TaskAttachment | None:
        return self.db.get(TaskAttachment, attachment_id)

    def delete_attachment(self, attachment: TaskAttachment) -> None:
        self.db.delete(attachment)

    def list_attachment_keys_for_project(self, project_id: int) -> list[str]:
        stmt = (
            select(TaskAttachment.storage_key)
            .join(Task, Task.id == TaskAttachment.task_id)
            .where(Task.project_id == project_id)
        )
        return list(self.db.execute(stmt).scalars().all())

    def sum_attachment_usage_for_organization(self, organization_id: int) -> tuple[int, int]:
        stmt = (
            select(
                func.coalesce(func.sum(TaskAttachment.size), 0),
                func.count(TaskAttachment.id),
            )
            .select_from(TaskAttachment)
            .join(Task, Task.id == TaskAttachment.task_id)
            .join(Project, Project.id == Task.project_id)
            .where(Project.organization_id == organization_id)
        )
        used_bytes, file_count = self.db.execute(stmt).one()
        return int(used_bytes), int(file_count)

    def counts_by_project(self) -> dict[int, dict[TaskStatus, int]]:
        stmt = select(Task.project_id, Task.status, func.count(Task.id)).group_by(
            Task.project_id, Task.status
        )
        grouped: dict[int, dict[TaskStatus, int]] = {}
        for project_id, status, count in self.db.execute(stmt):
            grouped.setdefault(project_id, {})[status] = int(count)
        return grouped

    def counts_by_assignee(self) -> dict[int, dict[TaskStatus, int]]:
        stmt = select(Task.assigned_user_id, Task.status, func.count(Task.id)).group_by(
            Task.assigned_user_id, Task.status
        )
        grouped: dict[int, dict[TaskStatus, int]] = {}
        for user_id, status, count in self.db.execute(stmt):
            grouped.setdefault(user_id, {})[status] = int(count)
        return grouped
