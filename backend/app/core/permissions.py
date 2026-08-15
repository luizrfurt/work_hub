from app.core.exceptions import ForbiddenError
from app.models.user import User, UserRole


def is_admin(user: User) -> bool:
    return user.role == UserRole.ADMIN


def require_admin(user: User) -> None:
    if not is_admin(user):
        raise ForbiddenError("Apenas administradores podem realizar esta ação.")


def same_organization(left: User, right: User) -> bool:
    return left.organization_id == right.organization_id
