from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.attachment import MessageAttachment
from app.models.message import Message


class MessageRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, message_id: int) -> Message | None:
        stmt = (
            select(Message)
            .options(selectinload(Message.attachments), selectinload(Message.author))
            .where(Message.id == message_id)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_by_project(self, project_id: int, limit: int, offset: int) -> tuple[list[Message], int]:
        total = self.db.execute(
            select(func.count(Message.id)).where(Message.project_id == project_id)
        ).scalar_one()

        stmt = (
            select(Message)
            .options(selectinload(Message.attachments), selectinload(Message.author))
            .where(Message.project_id == project_id)
            .order_by(Message.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        items = list(self.db.execute(stmt).scalars().all())
        items.reverse()
        return items, total

    def add(self, message: Message) -> Message:
        self.db.add(message)
        self.db.flush()
        return message

    def add_attachment(self, attachment: MessageAttachment) -> MessageAttachment:
        self.db.add(attachment)
        self.db.flush()
        return attachment

    def get_attachment(self, attachment_id: int) -> MessageAttachment | None:
        return self.db.get(MessageAttachment, attachment_id)

    def last_message_at(self, project_id: int) -> datetime | None:
        stmt = select(func.max(Message.created_at)).where(Message.project_id == project_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def last_message_times(self) -> dict[int, datetime]:
        stmt = select(Message.project_id, func.max(Message.created_at)).group_by(Message.project_id)
        return {int(project_id): created_at for project_id, created_at in self.db.execute(stmt)}

    def list_attachment_keys_for_project(self, project_id: int) -> list[str]:
        stmt = (
            select(MessageAttachment.storage_key)
            .join(Message, Message.id == MessageAttachment.message_id)
            .where(Message.project_id == project_id)
        )
        return list(self.db.execute(stmt).scalars().all())
