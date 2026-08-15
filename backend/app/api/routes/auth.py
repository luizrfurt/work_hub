from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_optional_refresh_token
from app.database.connection import get_db
from app.models.user import User
from app.schemas.user import (
    AccessTokenResponse,
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserPublic,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    service = AuthService(db)
    access_token, refresh_token, user = service.login(payload.username, payload.password)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserPublic.model_validate(user),
    )


@router.post("/refresh", response_model=AccessTokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> AccessTokenResponse:
    service = AuthService(db)
    access_token, refresh_token, _user = service.refresh(payload.refresh_token)
    return AccessTokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/logout")
def logout(
    payload: RefreshRequest | None = None,
    db: Session = Depends(get_db),
    header_refresh: str | None = Depends(get_optional_refresh_token),
) -> dict[str, str]:
    token = payload.refresh_token if payload else header_refresh
    AuthService(db).logout(token)
    return {"message": "Logout realizado."}


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    AuthService(db).change_password(
        current_user,
        payload.current_password,
        payload.new_password,
    )
    return {"message": "Senha alterada. Faça login novamente."}


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
