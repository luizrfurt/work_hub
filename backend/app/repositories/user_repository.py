from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User, UserRole


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, user_id: int) -> User | None:
        return self.db.get(User, user_id)

    def get_by_username(self, username: str) -> User | None:
        stmt = select(User).where(User.username == username)
        return self.db.execute(stmt).scalar_one_or_none()

    def list_all(self) -> list[User]:
        stmt = select(User).order_by(User.name.asc())
        return list(self.db.execute(stmt).scalars().all())

    def list_by_organization(self, organization_id: int) -> list[User]:
        stmt = (
            select(User)
            .where(User.organization_id == organization_id)
            .order_by(User.name.asc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def list_active_admin_ids(self, organization_id: int) -> list[int]:
        stmt = select(User.id).where(
            User.organization_id == organization_id,
            User.role == UserRole.ADMIN,
            User.is_active.is_(True),
        )
        return [int(item) for item in self.db.execute(stmt).scalars().all()]

    def add(self, user: User) -> User:
        self.db.add(user)
        self.db.flush()
        return user
