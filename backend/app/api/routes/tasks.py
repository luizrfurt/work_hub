from fastapi import APIRouter, Depends, File, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.connection import get_db
from app.models.user import User
from app.schemas.task import TaskCreate, TaskPublic, TaskUpdate
from app.services.task_service import TaskService
from app.storage import storage

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


@router.delete("/{task_id}", status_code=204)
def delete_task(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    TaskService(db).delete_task(project_id, task_id, current_user)
    return Response(status_code=204)


@router.post("/{task_id}/attachments", response_model=TaskPublic, status_code=201)
async def upload_task_attachment(
    project_id: int,
    task_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskPublic:
    return TaskService(db).add_attachment(project_id, task_id, current_user, file)


@router.get("/{task_id}/attachments/{attachment_id}")
def download_task_attachment(
    project_id: int,
    task_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    attachment = TaskService(db).get_attachment_for_download(
        project_id, task_id, attachment_id, current_user
    )
    return FileResponse(
        path=storage.path_for(attachment.storage_key),
        media_type=attachment.mime_type,
        filename=attachment.original_name,
    )


@router.delete("/{task_id}/attachments/{attachment_id}", response_model=TaskPublic)
def delete_task_attachment(
    project_id: int,
    task_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskPublic:
    return TaskService(db).delete_attachment(project_id, task_id, attachment_id, current_user)
