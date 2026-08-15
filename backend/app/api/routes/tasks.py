from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.connection import get_db
from app.models.user import User
from app.schemas.task import TaskCreate, TaskPublic, TaskUpdate
from app.services.task_service import TaskService

router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskPublic])
def list_tasks(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TaskPublic]:
    return TaskService(db).list_tasks(project_id, current_user)


@router.post("", response_model=TaskPublic, status_code=201)
def create_task(
    project_id: int,
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskPublic:
    return TaskService(db).create_task(project_id, payload, current_user)


@router.get("/{task_id}", response_model=TaskPublic)
def get_task(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskPublic:
    return TaskService(db).get_task(project_id, task_id, current_user)


@router.patch("/{task_id}", response_model=TaskPublic)
def update_task(
    project_id: int,
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskPublic:
    return TaskService(db).update_task(project_id, task_id, payload, current_user)
