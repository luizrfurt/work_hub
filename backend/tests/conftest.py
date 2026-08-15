from collections.abc import Generator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from main import app
from app.models.user import UserRole


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def unique() -> str:
    return uuid4().hex[:10]


def register_admin(client: TestClient, unique: str) -> dict:
    from app.database.connection import SessionLocal
    from app.services.auth_service import AuthService

    username = f"wh_admin_{unique}"
    password = "senha1234"
    db = SessionLocal()
    try:
        AuthService(db).create_admin(
            name=f"Admin {unique}",
            username=username,
            password=password,
        )
    finally:
        db.close()

    response = client.post("/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return response.json()


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def create_collaborator(client: TestClient, admin_token: str, unique: str, suffix: str = "c") -> dict:
    username = f"wh_col_{suffix}_{unique}"
    payload = {
        "username": username,
        "name": f"Colaborador {suffix} {unique}",
        "password": "senha1234",
        "role": UserRole.COLLABORATOR.value,
    }
    response = client.post("/users", json=payload, headers=auth_header(admin_token))
    assert response.status_code == 201, response.text
    login = client.post("/auth/login", json={"username": username, "password": "senha1234"})
    assert login.status_code == 200, login.text
    return login.json()
