from tests.conftest import auth_header, create_collaborator, register_admin


def test_login_valid(client, unique):
    session = register_admin(client, unique)
    assert session["access_token"]
    assert session["refresh_token"]
    assert session["user"]["role"] == "ADMIN"


def test_login_invalid(client):
    response = client.post(
        "/auth/login",
        json={"username": "naoexiste", "password": "errada123"},
    )
    assert response.status_code == 401
    assert response.json()["message"] == "Usuário ou senha inválidos."


def test_refresh_valid(client, unique):
    session = register_admin(client, unique)
    response = client.post("/auth/refresh", json={"refresh_token": session["refresh_token"]})
    assert response.status_code == 200
    assert response.json()["access_token"]
    assert response.json()["refresh_token"] != session["refresh_token"]


def test_refresh_invalid(client):
    response = client.post("/auth/refresh", json={"refresh_token": "token-invalido"})
    assert response.status_code == 401
    assert "login" in response.json()["message"].lower()


def test_username_unique(client, unique):
    session = register_admin(client, unique)
    payload = {
        "username": session["user"]["username"],
        "name": "Outro",
        "password": "senha1234",
        "role": "COLLABORATOR",
    }
    response = client.post("/users", json=payload, headers=auth_header(session["access_token"]))
    assert response.status_code == 409
    assert "já está em uso" in response.json()["message"]


def test_admin_can_change_user_role(client, unique):
    admin = register_admin(client, unique)
    collab = create_collaborator(client, admin["access_token"], unique)
    user_id = collab["user"]["id"]
    response = client.patch(
        f"/users/{user_id}",
        json={"role": "ADMIN", "name": "Novo Nome"},
        headers=auth_header(admin["access_token"]),
    )
    assert response.status_code == 200, response.text
    assert response.json()["role"] == "ADMIN"
    assert response.json()["name"] == "Novo Nome"


def test_collaborator_cannot_update_user(client, unique):
    admin = register_admin(client, unique)
    collab = create_collaborator(client, admin["access_token"], unique)
    response = client.patch(
        f"/users/{collab['user']['id']}",
        json={"role": "ADMIN"},
        headers=auth_header(collab["access_token"]),
    )
    assert response.status_code == 403


def test_user_can_change_own_password(client, unique):
    admin = register_admin(client, unique)
    collab = create_collaborator(client, admin["access_token"], unique)
    response = client.post(
        "/auth/change-password",
        json={"current_password": "senha1234", "new_password": "novaSenha9"},
        headers=auth_header(collab["access_token"]),
    )
    assert response.status_code == 200, response.text

    old_login = client.post(
        "/auth/login",
        json={"username": collab["user"]["username"], "password": "senha1234"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/auth/login",
        json={"username": collab["user"]["username"], "password": "novaSenha9"},
    )
    assert new_login.status_code == 200


def test_change_password_rejects_wrong_current(client, unique):
    admin = register_admin(client, unique)
    response = client.post(
        "/auth/change-password",
        json={"current_password": "errada123", "new_password": "novaSenha9"},
        headers=auth_header(admin["access_token"]),
    )
    assert response.status_code == 400
    assert "atual" in response.json()["message"].lower()


def test_admin_can_change_another_user_password(client, unique):
    admin = register_admin(client, unique)
    collab = create_collaborator(client, admin["access_token"], unique)
    response = client.patch(
        f"/users/{collab['user']['id']}",
        json={"password": "senhaAdmin1"},
        headers=auth_header(admin["access_token"]),
    )
    assert response.status_code == 200, response.text

    old_login = client.post(
        "/auth/login",
        json={"username": collab["user"]["username"], "password": "senha1234"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/auth/login",
        json={"username": collab["user"]["username"], "password": "senhaAdmin1"},
    )
    assert new_login.status_code == 200


def test_admin_can_change_own_and_other_username(client, unique):
    admin = register_admin(client, unique)
    collab = create_collaborator(client, admin["access_token"], unique)
    new_collab_username = f"wh_renamed_{unique}"
    new_admin_username = f"wh_admin_new_{unique}"

    other = client.patch(
        f"/users/{collab['user']['id']}",
        json={"username": new_collab_username},
        headers=auth_header(admin["access_token"]),
    )
    assert other.status_code == 200, other.text
    assert other.json()["username"] == new_collab_username

    old_collab_login = client.post(
        "/auth/login",
        json={"username": collab["user"]["username"], "password": "senha1234"},
    )
    assert old_collab_login.status_code == 401

    new_collab_login = client.post(
        "/auth/login",
        json={"username": new_collab_username, "password": "senha1234"},
    )
    assert new_collab_login.status_code == 200

    own = client.patch(
        f"/users/{admin['user']['id']}",
        json={"username": new_admin_username},
        headers=auth_header(admin["access_token"]),
    )
    assert own.status_code == 200, own.text
    assert own.json()["username"] == new_admin_username

    own_login = client.post(
        "/auth/login",
        json={"username": new_admin_username, "password": "senha1234"},
    )
    assert own_login.status_code == 200
