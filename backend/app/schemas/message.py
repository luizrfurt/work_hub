from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class AttachmentPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    original_name: str
    mime_type: str
    size: int
    created_at: datetime


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=8000)


class MessageUpdate(BaseModel):
    content: str = Field(max_length=8000)


class MessagePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    user_id: int
    author_name: str
    content: str | None
    attachments: list[AttachmentPublic] = []
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class MessageList(BaseModel):
    items: list[MessagePublic]
    limit: int
    offset: int
    total: int
