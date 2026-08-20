from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.connection import get_db
from app.models.user import User
from app.schemas.project import (
    OverviewPublic,
    ProjectCreate,
    ProjectMemberAdd,
    ProjectMemberPublic,
    ProjectPublic,
    ProjectReadStatesSync,
    ProjectUpdate,
    StorageUsagePublic,
)
from app.services.project_service import ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectPublic, status_code=201)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectPublic:
    service = ProjectService(db)
    project = service.create_project(payload, current_user)
    return ProjectPublic(
        id=project.id,
        name=project.name,
        description=project.description,
        created_by=project.created_by,
        member_count=1,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.get("", response_model=list[ProjectPublic])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ProjectPublic]:
    return ProjectService(db).list_projects(current_user)


@router.get("/overview", response_model=OverviewPublic)
def get_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OverviewPublic:
    return ProjectService(db).get_overview(current_user)


@router.get("/storage", response_model=StorageUsagePublic)
def get_storage_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StorageUsagePublic:
    return ProjectService(db).get_storage_usage(current_user)


@router.put("/read-states", status_code=204)
def sync_read_states(
    payload: ProjectReadStatesSync,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    ProjectService(db).sync_read_states(payload.last_read, current_user)
    return Response(status_code=204)


@router.get("/{project_id}", response_model=ProjectPublic)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectPublic:
    return ProjectService(db).get_project(project_id, current_user)


@router.post("/{project_id}/read", status_code=204)
def mark_project_read(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    ProjectService(db).mark_project_read(project_id, current_user)
    return Response(status_code=204)


@router.patch("/{project_id}", response_model=ProjectPublic)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectPublic:
    return ProjectService(db).update_project(project_id, payload, current_user)


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    ProjectService(db).delete_project(project_id, current_user)
    return Response(status_code=204)


@router.get("/{project_id}/members", response_model=list[ProjectMemberPublic])
def list_members(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ProjectMemberPublic]:
    return ProjectService(db).list_members(project_id, current_user)


@router.post("/{project_id}/members", response_model=ProjectMemberPublic, status_code=201)
def add_member(
    project_id: int,
    payload: ProjectMemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectMemberPublic:
    return ProjectService(db).add_member(project_id, payload.user_id, current_user)


@router.delete("/{project_id}/members/{user_id}", status_code=204)
def remove_member(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    ProjectService(db).remove_member(project_id, user_id, current_user)
    return Response(status_code=204)
