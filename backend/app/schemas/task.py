from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field

from app.models.task import TaskStatus
from app.schemas.message import AttachmentPublic


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    due_date: date | None = None
    assigned_user_id: int
    status: TaskStatus = TaskStatus.TODO
    position: int | None = Field(default=None, ge=0)


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    due_date: date | None = None
    assigned_user_id: int | None = None
    status: TaskStatus | None = None
    position: int | None = Field(default=None, ge=0)


class TaskPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    title: str
    description: str | None
    due_date: date | None
    assigned_user_id: int
    assigned_user_name: str
    status: TaskStatus
    position: int
    created_by: int
    created_at: datetime
    updated_at: datetime
    attachments: list[AttachmentPublic] = []
