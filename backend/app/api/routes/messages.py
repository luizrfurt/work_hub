from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.connection import get_db
from app.models.user import User
from app.schemas.message import MessageCreate, MessageList, MessagePublic, MessageUpdate
from app.services.message_service import MessageService
from app.storage import storage

router = APIRouter(prefix="/projects/{project_id}", tags=["messages"])


@router.get("/messages", response_model=MessageList)
def list_messages(
    project_id: int,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageList:
    return MessageService(db).list_messages(project_id, current_user, limit, offset)


@router.post("/messages", response_model=MessagePublic, status_code=201)
def create_message(
    project_id: int,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessagePublic:
    return MessageService(db).create_text_message(project_id, payload.content, current_user)


@router.patch("/messages/{message_id}", response_model=MessagePublic)
def update_message(
    project_id: int,
    message_id: int,
    payload: MessageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessagePublic:
    return MessageService(db).update_message(
        project_id, message_id, payload.content, current_user
    )


@router.delete("/messages/{message_id}", status_code=204)
def delete_message(
    project_id: int,
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    MessageService(db).delete_message(project_id, message_id, current_user)
    return Response(status_code=204)


@router.post("/attachments", response_model=MessagePublic, status_code=201)
async def upload_attachment(
    project_id: int,
    file: UploadFile = File(...),
    content: str | None = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessagePublic:
    return MessageService(db).create_message_with_attachment(
        project_id, current_user, file, content
    )


@router.get("/attachments/{attachment_id}")
def download_attachment(
    project_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    attachment = MessageService(db).get_attachment_for_download(
        project_id, attachment_id, current_user
    )
    return FileResponse(
        path=storage.path_for(attachment.storage_key),
        media_type=attachment.mime_type,
        filename=attachment.original_name,
    )
