from datetime import datetime

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.attachment import MessageAttachment
from app.models.message import Message
from app.models.project import Project
from app.models.project_read_state import ProjectReadState

_MESSAGE_LOAD = (
    selectinload(Message.attachments),
    selectinload(Message.author),
    selectinload(Message.reply_to).selectinload(Message.author),
    selectinload(Message.reply_to).selectinload(Message.attachments),
)


class MessageRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, message_id: int) -> Message | None:
        stmt = (
            select(Message)
            .options(*_MESSAGE_LOAD)
            .where(Message.id == message_id)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_by_project(self, project_id: int, limit: int, offset: int) -> tuple[list[Message], int]:
        total = self.db.execute(
            select(func.count(Message.id)).where(Message.project_id == project_id)
        ).scalar_one()

        stmt = (
            select(Message)
            .options(*_MESSAGE_LOAD)
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

    def delete(self, message: Message) -> None:
        self.db.delete(message)

    def get_attachment(self, attachment_id: int) -> MessageAttachment | None:
        return self.db.get(MessageAttachment, attachment_id)

    def last_message_at(self, project_id: int) -> datetime | None:
        stmt = select(func.max(Message.created_at)).where(Message.project_id == project_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def last_message_times(self) -> dict[int, datetime]:
        stmt = select(Message.project_id, func.max(Message.created_at)).group_by(Message.project_id)
        return {int(project_id): created_at for project_id, created_at in self.db.execute(stmt)}

    def unread_counts_for_user(self, user_id: int, project_ids: list[int]) -> dict[int, int]:
        if not project_ids:
            return {}
        stmt = (
            select(Message.project_id, func.count(Message.id))
            .outerjoin(
                ProjectReadState,
                and_(
                    ProjectReadState.project_id == Message.project_id,
                    ProjectReadState.user_id == user_id,
                ),
            )
            .where(
                Message.project_id.in_(project_ids),
                Message.user_id != user_id,
                Message.deleted_at.is_(None),
                or_(
                    ProjectReadState.last_read_at.is_(None),
                    Message.created_at > ProjectReadState.last_read_at,
                ),
            )
            .group_by(Message.project_id)
        )
        return {int(project_id): int(count) for project_id, count in self.db.execute(stmt)}

    def sum_attachment_usage_for_organization(self, organization_id: int) -> tuple[int, int]:
        stmt = (
            select(
                func.coalesce(func.sum(MessageAttachment.size), 0),
                func.count(MessageAttachment.id),
            )
            .select_from(MessageAttachment)
            .join(Message, Message.id == MessageAttachment.message_id)
            .join(Project, Project.id == Message.project_id)
            .where(Project.organization_id == organization_id)
        )
        used_bytes, file_count = self.db.execute(stmt).one()
        return int(used_bytes), int(file_count)

    def list_attachment_keys_for_project(self, project_id: int) -> list[str]:
        stmt = (
            select(MessageAttachment.storage_key)
            .join(Message, Message.id == MessageAttachment.message_id)
            .where(Message.project_id == project_id)
        )
        return list(self.db.execute(stmt).scalars().all())
