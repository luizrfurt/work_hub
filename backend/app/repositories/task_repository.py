from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.task import Task, TaskStatus


class TaskRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, task_id: int) -> Task | None:
        stmt = (
            select(Task)
            .options(selectinload(Task.assigned_user))
            .where(Task.id == task_id)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_by_project(self, project_id: int) -> list[Task]:
        stmt = (
            select(Task)
            .options(selectinload(Task.assigned_user))
            .where(Task.project_id == project_id)
            .order_by(Task.position.asc(), Task.created_at.asc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def list_by_project_status(self, project_id: int, status: TaskStatus) -> list[Task]:
        stmt = (
            select(Task)
            .options(selectinload(Task.assigned_user))
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
