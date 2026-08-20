from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=2000)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=2000)


class ProjectPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    created_by: int
    member_count: int = 0
    last_message_at: datetime | None = None
    unread_count: int = 0
    created_at: datetime
    updated_at: datetime


class ProjectMemberAdd(BaseModel):
    user_id: int


class ProjectReadStatesSync(BaseModel):
    last_read: dict[str, datetime]


class ProjectMemberPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    username: str
    name: str
    joined_at: datetime


class OverviewProject(BaseModel):
    id: int
    name: str
    member_count: int
    todo: int
    in_progress: int
    done: int
    active: int
    total: int


class OverviewContributor(BaseModel):
    user_id: int
    name: str
    username: str
    todo: int
    in_progress: int
    done: int
    active: int
    total: int


class StorageUsagePublic(BaseModel):
    storage_used_bytes: int
    storage_quota_bytes: int
    storage_file_count: int


class OverviewPublic(BaseModel):
    project_count: int
    people_count: int
    todo: int
    in_progress: int
    done: int
    active: int
    total: int
    storage_used_bytes: int
    storage_quota_bytes: int
    storage_file_count: int
    projects: list[OverviewProject]
    contributors: list[OverviewContributor]
