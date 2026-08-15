from datetime import datetime, timedelta, timezone
import jwt
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import AppError, ConflictError, NotFoundError, UnauthorizedError
from app.core.permissions import require_admin, same_organization
from app.core.security import (
    MIN_PASSWORD_LENGTH,
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models.organization import Organization
from app.models.refresh_token import RefreshToken
from app.models.user import User, UserRole
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserCreate, UserUpdate


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.organizations = OrganizationRepository(db)
        self.refresh_tokens = RefreshTokenRepository(db)

    def create_user(self, payload: UserCreate, actor: User) -> User:
        require_admin(actor)
        if len(payload.password) < MIN_PASSWORD_LENGTH:
            raise ConflictError(f"A senha deve ter no mínimo {MIN_PASSWORD_LENGTH} caracteres.")
        if self.users.get_by_username(payload.username.strip()):
            raise ConflictError("Nome de usuário já está em uso.")

        user = User(
            organization_id=actor.organization_id,
            username=payload.username.strip(),
            name=payload.name.strip(),
            password_hash=hash_password(payload.password),
            role=payload.role,
            is_active=True,
        )
        try:
            self.users.add(user)
            self.db.commit()
            self.db.refresh(user)
        except IntegrityError:
            self.db.rollback()
            raise ConflictError("Nome de usuário já está em uso.")
        return user

    def create_admin(
        self,
        name: str,
        username: str,
        password: str,
        organization_name: str | None = None,
    ) -> User:
        if len(password) < MIN_PASSWORD_LENGTH:
            raise ValueError(f"A senha deve ter no mínimo {MIN_PASSWORD_LENGTH} caracteres.")
        if self.users.get_by_username(username.strip()):
            raise ValueError("Nome de usuário já está em uso.")

        org_name = (organization_name or f"Organização de {name}").strip()
        if not org_name:
            raise ValueError("O nome da organização é obrigatório.")

        organization = Organization(name=org_name)
        try:
            self.organizations.add(organization)
            user = User(
                organization_id=organization.id,
                username=username.strip(),
                name=name.strip(),
                password_hash=hash_password(password),
                role=UserRole.ADMIN,
                is_active=True,
            )
            self.users.add(user)
            self.db.commit()
            self.db.refresh(user)
        except IntegrityError:
            self.db.rollback()
            raise ValueError("Nome de usuário já está em uso.")
        return user

    def reset_password(self, username: str, password: str) -> User:
        if len(password) < MIN_PASSWORD_LENGTH:
            raise ValueError(f"A senha deve ter no mínimo {MIN_PASSWORD_LENGTH} caracteres.")
        user = self.users.get_by_username(username.strip())
        if user is None:
            raise ValueError("Usuário não encontrado.")
        user.password_hash = hash_password(password)
        user.is_active = True
        self.refresh_tokens.revoke_all_for_user(user.id)
        self.db.commit()
        self.db.refresh(user)
        return user

    def change_password(self, actor: User, current_password: str, new_password: str) -> None:
        if not verify_password(current_password, actor.password_hash):
            raise AppError("Senha atual incorreta.", 400)
        if len(new_password) < MIN_PASSWORD_LENGTH:
            raise ConflictError(f"A senha deve ter no mínimo {MIN_PASSWORD_LENGTH} caracteres.")
        if verify_password(new_password, actor.password_hash):
            raise ConflictError("A nova senha deve ser diferente da atual.")
        actor.password_hash = hash_password(new_password)
        self.refresh_tokens.revoke_all_for_user(actor.id)
        self.db.commit()

    def update_user(self, user_id: int, payload: UserUpdate, actor: User) -> User:
        require_admin(actor)
        user = self._get_org_user(user_id, actor)

        next_role = payload.role if payload.role is not None else user.role
        next_active = payload.is_active if payload.is_active is not None else user.is_active
        losing_admin = user.role == UserRole.ADMIN and user.is_active and (
            next_role != UserRole.ADMIN or next_active is False
        )
        if losing_admin:
            active_admins = [
                item
                for item in self.users.list_by_organization(actor.organization_id)
                if item.role == UserRole.ADMIN and item.is_active
            ]
            if len(active_admins) <= 1:
                raise ConflictError("Não é possível remover o último administrador ativo.")

        if payload.username is not None:
            username = payload.username.strip()
            existing = self.users.get_by_username(username)
            if existing is not None and existing.id != user.id:
                raise ConflictError("Nome de usuário já está em uso.")
            user.username = username
        if payload.name is not None:
            user.name = payload.name.strip()
        if payload.role is not None:
            user.role = payload.role
        if payload.is_active is not None:
            user.is_active = payload.is_active
        if payload.password is not None:
            if len(payload.password) < MIN_PASSWORD_LENGTH:
                raise ConflictError(f"A senha deve ter no mínimo {MIN_PASSWORD_LENGTH} caracteres.")
            user.password_hash = hash_password(payload.password)
            self.refresh_tokens.revoke_all_for_user(user.id)

        try:
            self.db.commit()
            self.db.refresh(user)
        except IntegrityError:
            self.db.rollback()
            raise ConflictError("Nome de usuário já está em uso.")
        return user

    def list_users(self, actor: User) -> list[User]:
        return self.users.list_by_organization(actor.organization_id)

    def get_user(self, user_id: int, actor: User) -> User:
        require_admin(actor)
        return self._get_org_user(user_id, actor)

    def login(self, username: str, password: str) -> tuple[str, str, User]:
        user = self.users.get_by_username(username.strip())
        if user is None or not user.is_active or not verify_password(password, user.password_hash):
            raise UnauthorizedError("Usuário ou senha inválidos.")

        access_token = create_access_token(user.id, user.role.value)
        refresh_plain, _refresh = self._issue_refresh_token(user.id)
        self.db.commit()
        return access_token, refresh_plain, user

    def refresh(self, refresh_token: str) -> tuple[str, str, User]:
        token_hash = hash_refresh_token(refresh_token)
        stored = self.refresh_tokens.get_by_hash(token_hash)
        now = datetime.now(timezone.utc)

        if (
            stored is None
            or stored.revoked_at is not None
            or stored.expires_at <= now
        ):
            raise UnauthorizedError("Sessão expirada. Faça login novamente.")

        user = self.users.get_by_id(stored.user_id)
        if user is None or not user.is_active:
            raise UnauthorizedError("Sessão expirada. Faça login novamente.")

        self.refresh_tokens.revoke(stored)
        access_token = create_access_token(user.id, user.role.value)
        refresh_plain, _new = self._issue_refresh_token(user.id)
        self.db.commit()
        return access_token, refresh_plain, user

    def logout(self, refresh_token: str | None) -> None:
        if not refresh_token:
            return
        stored = self.refresh_tokens.get_by_hash(hash_refresh_token(refresh_token))
        if stored is not None and stored.revoked_at is None:
            self.refresh_tokens.revoke(stored)
            self.db.commit()

    def get_user_from_access_token(self, token: str) -> User:
        try:
            payload = decode_access_token(token)
        except jwt.ExpiredSignatureError:
            raise UnauthorizedError("Token expirado.")
        except jwt.InvalidTokenError:
            raise UnauthorizedError("Token inválido.")

        user_id = payload.get("sub")
        if not user_id:
            raise UnauthorizedError("Token inválido.")

        try:
            parsed_id = int(user_id)
        except (TypeError, ValueError):
            raise UnauthorizedError("Token inválido.")

        user = self.users.get_by_id(parsed_id)
        if user is None or not user.is_active:
            raise UnauthorizedError("Usuário inativo ou inexistente.")
        return user

    def _get_org_user(self, user_id: int, actor: User) -> User:
        user = self.users.get_by_id(user_id)
        if user is None or not same_organization(actor, user):
            raise NotFoundError("Usuário não encontrado.")
        return user

    def _issue_refresh_token(self, user_id: int) -> tuple[str, RefreshToken]:
        from app.core.config import get_settings

        settings = get_settings()
        plain = generate_refresh_token()
        record = RefreshToken(
            user_id=user_id,
            token_hash=hash_refresh_token(plain),
            expires_at=datetime.now(timezone.utc)
            + timedelta(days=settings.refresh_token_expire_days),
        )
        self.refresh_tokens.add(record)
        return plain, record
