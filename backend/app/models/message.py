from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    previous_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reply_to_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("messages.id", ondelete="SET NULL"), nullable=True, index=True
    )

    project = relationship("Project", back_populates="messages")
    author = relationship("User")
    reply_to: Mapped["Message | None"] = relationship(
        "Message",
        remote_side="Message.id",
        foreign_keys=[reply_to_id],
    )
    attachments = relationship(
        "MessageAttachment", back_populates="message", cascade="all, delete-orphan"
    )
