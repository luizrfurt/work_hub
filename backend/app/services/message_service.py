from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.models.attachment import MessageAttachment
from app.models.message import Message
from app.models.user import User
from app.realtime.manager import connection_manager
from app.repositories.message_repository import MessageRepository
from app.schemas.message import AttachmentPublic, MessageList, MessagePublic
from app.services.project_service import ProjectService
from app.storage import storage

ALLOWED_MIME_TYPES = {
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/webp": {".webp"},
    "text/plain": {".txt"},
}

MAGIC_CHECKS = {
    "image/jpeg": lambda data: data[:3] == b"\xff\xd8\xff",
    "image/png": lambda data: data[:8] == b"\x89PNG\r\n\x1a\n",
    "image/webp": lambda data: data[:4] == b"RIFF" and data[8:12] == b"WEBP",
    "text/plain": lambda data: b"\x00" not in data[:1024],
}


class MessageService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.messages = MessageRepository(db)
        self.project_service = ProjectService(db)

    def list_messages(
        self, project_id: int, actor: User, limit: int = 50, offset: int = 0
    ) -> MessageList:
        self.project_service.assert_can_access(project_id, actor)
        limit = min(max(limit, 1), 100)
        offset = max(offset, 0)
        items, total = self.messages.list_by_project(project_id, limit, offset)
        return MessageList(
            items=[self._to_public(item) for item in items],
            limit=limit,
            offset=offset,
            total=total,
        )

    def create_text_message(self, project_id: int, content: str, actor: User) -> MessagePublic:
        project = self.project_service.assert_can_access(project_id, actor)
        text = content.strip()
        if not text:
            raise AppError("A mensagem não pode estar vazia.")

        message = Message(project_id=project_id, user_id=actor.id, content=text)
        self.messages.add(message)
        self.db.commit()
        stored = self.messages.get_by_id(message.id)
        assert stored is not None
        public = self._to_public(stored)
        self._publish_message(project.id, project.name, actor.id, public)
        return public

    def create_message_with_attachment(
        self, project_id: int, actor: User, file: UploadFile, content: str | None
    ) -> MessagePublic:
        project = self.project_service.assert_can_access(project_id, actor)
        data = file.file.read()
        mime_type, original_name = self._validate_file(file, data)
        text = (content or "").strip() or None

        message = Message(project_id=project_id, user_id=actor.id, content=text)
        self.messages.add(message)

        storage_key = f"{project_id}/{uuid4()}_{original_name}"
        storage.save(storage_key, data)
        attachment = MessageAttachment(
            message_id=message.id,
            original_name=original_name,
            storage_key=storage_key,
            mime_type=mime_type,
            size=len(data),
        )
        self.messages.add_attachment(attachment)
        self.db.commit()

        stored = self.messages.get_by_id(message.id)
        assert stored is not None
        public = self._to_public(stored)
        self._publish_message(project.id, project.name, actor.id, public)
        return public

    def get_attachment_for_download(
        self, project_id: int, attachment_id: int, actor: User
    ) -> MessageAttachment:
        self.project_service.assert_can_access(project_id, actor)
        attachment = self.messages.get_attachment(attachment_id)
        if attachment is None:
            raise AppError("Anexo não encontrado.", status_code=404)
        message = self.messages.get_by_id(attachment.message_id)
        if message is None or message.project_id != project_id:
            raise AppError("Anexo não encontrado.", status_code=404)
        return attachment

    def _validate_file(self, file: UploadFile, data: bytes) -> tuple[str, str]:
        settings = get_settings()
        if not data:
            raise AppError("Arquivo vazio.")
        if len(data) > settings.upload_max_size_bytes:
            raise AppError(f"Arquivo excede o limite de {settings.upload_max_size_mb} MB.")

        original_name = (file.filename or "arquivo").strip()
        extension = ""
        if "." in original_name:
            extension = "." + original_name.rsplit(".", 1)[-1].lower()

        declared = (file.content_type or "").split(";")[0].strip().lower()
        if declared not in ALLOWED_MIME_TYPES:
            raise AppError("Tipo de arquivo não permitido. Envie JPEG, PNG, WEBP ou TXT.")
        if extension not in ALLOWED_MIME_TYPES[declared]:
            raise AppError("A extensão do arquivo não corresponde ao tipo informado.")
        if not MAGIC_CHECKS[declared](data):
            raise AppError("O conteúdo do arquivo não corresponde ao tipo informado.")

        return declared, original_name

    def _publish_message(self, project_id: int, project_name: str, author_id: int, public: MessagePublic) -> None:
        event = {
            "type": "message",
            "payload": public.model_dump(mode="json"),
            "project_name": project_name,
        }
        connection_manager.broadcast_nowait(project_id, event)
        audience = [
            user_id
            for user_id in self.project_service.list_notification_user_ids(project_id)
            if user_id != author_id
        ]
        connection_manager.notify_users_nowait(audience, event)

    def _to_public(self, message: Message) -> MessagePublic:
        return MessagePublic(
            id=message.id,
            project_id=message.project_id,
            user_id=message.user_id,
            author_name=message.author.name if message.author else "",
            content=message.content,
            attachments=[
                AttachmentPublic(
                    id=item.id,
                    original_name=item.original_name,
                    mime_type=item.mime_type,
                    size=item.size,
                    created_at=item.created_at,
                )
                for item in message.attachments
            ],
            created_at=message.created_at,
        )
