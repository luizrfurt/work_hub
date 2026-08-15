from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import UnauthorizedError
from app.core.permissions import require_admin
from app.database.connection import get_db
from app.models.user import User
from app.services.auth_service import AuthService

bearer_scheme = HTTPBearer(auto_error=False)


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    return AuthService(db)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    auth_service: AuthService = Depends(get_auth_service),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise UnauthorizedError("Não autenticado.")
    return auth_service.get_user_from_access_token(credentials.credentials)


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    require_admin(user)
    return user


def get_optional_refresh_token(
    x_refresh_token: str | None = Header(default=None),
) -> str | None:
    return x_refresh_token
