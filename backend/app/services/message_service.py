from datetime import datetime, timezone
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.exceptions import AppError, ForbiddenError, NotFoundError
from app.core.uploads import validate_upload
from app.models.attachment import MessageAttachment
from app.models.message import Message
from app.models.user import User
from app.realtime.manager import connection_manager
from app.repositories.message_repository import MessageRepository
from app.schemas.message import AttachmentPublic, MessageList, MessagePublic, ReplyPreview
from app.services.project_service import ProjectService
from app.storage import storage


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

    def create_text_message(
        self,
        project_id: int,
        content: str,
        actor: User,
        reply_to_id: int | None = None,
    ) -> MessagePublic:
        project = self.project_service.assert_can_access(project_id, actor)
        text = content.strip()
        if not text:
            raise AppError("A mensagem não pode estar vazia.")

        message = Message(
            project_id=project_id,
            user_id=actor.id,
            content=text,
            reply_to_id=self._resolve_reply_to_id(project_id, reply_to_id),
        )
        self.messages.add(message)
        self.db.commit()
        stored = self.messages.get_by_id(message.id)
        assert stored is not None
        public = self._to_public(stored)
        self._publish_message(project.id, project.name, actor.id, public)
        return public

    def create_message_with_attachment(
        self,
        project_id: int,
        actor: User,
        file: UploadFile,
        content: str | None,
        reply_to_id: int | None = None,
    ) -> MessagePublic:
        project = self.project_service.assert_can_access(project_id, actor)
        data = file.file.read()
        mime_type, original_name = validate_upload(file, data)
        text = (content or "").strip() or None

        message = Message(
            project_id=project_id,
            user_id=actor.id,
            content=text,
            reply_to_id=self._resolve_reply_to_id(project_id, reply_to_id),
        )
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

    def update_message(
        self, project_id: int, message_id: int, content: str, actor: User
    ) -> MessagePublic:
        project = self.project_service.assert_can_access(project_id, actor)
        message = self._require_own_message(project_id, message_id, actor, "editar")
        text = content.strip() or None
        if not text and not message.attachments:
            raise AppError("A mensagem não pode ficar vazia.")
        if text != message.content:
            message.previous_content = message.content
            message.content = text
            message.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        stored = self.messages.get_by_id(message.id)
        assert stored is not None
        public = self._to_public(stored)
        self._broadcast_message(project.id, public)
        return public

    def delete_message(self, project_id: int, message_id: int, actor: User) -> MessagePublic:
        project = self.project_service.assert_can_access(project_id, actor)
        message = self._require_own_message(project_id, message_id, actor, "excluir")
        now = datetime.now(timezone.utc)
        message.deleted_at = now
        message.updated_at = now
        self.db.commit()
        stored = self.messages.get_by_id(message.id)
        assert stored is not None
        public = self._to_public(stored)
        self._broadcast_message(project.id, public)
        return public

    def get_attachment_for_download(
        self, project_id: int, attachment_id: int, actor: User
    ) -> MessageAttachment:
        self.project_service.assert_can_access(project_id, actor)
        attachment = self.messages.get_attachment(attachment_id)
        if attachment is None:
            raise AppError("Anexo não encontrado.", status_code=404)
        message = self.messages.get_by_id(attachment.message_id)
        if message is None or message.project_id != project_id or message.deleted_at is not None:
            raise AppError("Anexo não encontrado.", status_code=404)
        return attachment

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

    def _broadcast_message(self, project_id: int, public: MessagePublic) -> None:
        connection_manager.broadcast_nowait(
            project_id,
            {"type": "message", "payload": public.model_dump(mode="json")},
        )

    def _require_own_message(
        self, project_id: int, message_id: int, actor: User, action: str
    ) -> Message:
        message = self.messages.get_by_id(message_id)
        if message is None or message.project_id != project_id:
            raise NotFoundError("Mensagem não encontrada.")
        if message.user_id != actor.id:
            raise ForbiddenError(f"Você só pode {action} as próprias mensagens.")
        if message.deleted_at is not None:
            raise AppError("Esta mensagem já foi excluída.")
        return message

    def _resolve_reply_to_id(self, project_id: int, reply_to_id: int | None) -> int | None:
        if reply_to_id is None:
            return None
        original = self.messages.get_by_id(reply_to_id)
        if original is None or original.project_id != project_id:
            raise NotFoundError("Mensagem original não encontrada.")
        if original.deleted_at is not None:
            raise AppError("Não é possível responder a uma mensagem excluída.")
        return original.id

    def _to_reply_preview(self, original: Message | None) -> ReplyPreview | None:
        if original is None:
            return None
        deleted = original.deleted_at is not None
        return ReplyPreview(
            id=original.id,
            author_name=original.author.name if original.author else "",
            content=None if deleted else original.content,
            deleted=deleted,
            has_attachment=not deleted and len(original.attachments) > 0,
        )

    def _to_public(self, message: Message) -> MessagePublic:
        deleted = message.deleted_at is not None
        return MessagePublic(
            id=message.id,
            project_id=message.project_id,
            user_id=message.user_id,
            author_name=message.author.name if message.author else "",
            content=None if deleted else message.content,
            attachments=[]
            if deleted
            else [
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
            updated_at=message.updated_at,
            deleted_at=message.deleted_at,
            reply_to=None if deleted else self._to_reply_preview(message.reply_to),
        )
