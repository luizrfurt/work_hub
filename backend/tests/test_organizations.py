from tests.conftest import auth_header, create_collaborator, register_admin


def test_create_admin_creates_organization(client, unique):
    session = register_admin(client, unique)
    user = session["user"]
    assert user["organization_id"]
    assert user["role"] == "ADMIN"


def test_created_user_joins_admin_organization(client, unique):
    admin = register_admin(client, unique)
    collab = create_collaborator(client, admin["access_token"], unique)
    assert collab["user"]["organization_id"] == admin["user"]["organization_id"]


def test_admin_lists_only_own_organization_users(client, unique):
    admin_a = register_admin(client, f"{unique}a")
    admin_b = register_admin(client, f"{unique}b")
    collab_a = create_collaborator(client, admin_a["access_token"], f"{unique}a", "a")
    collab_b = create_collaborator(client, admin_b["access_token"], f"{unique}b", "b")

    listed = client.get("/users", headers=auth_header(admin_a["access_token"]))
    assert listed.status_code == 200, listed.text
    ids = {item["id"] for item in listed.json()}
    assert admin_a["user"]["id"] in ids
    assert collab_a["user"]["id"] in ids
    assert admin_b["user"]["id"] not in ids
    assert collab_b["user"]["id"] not in ids


def test_admin_cannot_get_or_update_user_from_other_organization(client, unique):
    admin_a = register_admin(client, f"{unique}a")
    admin_b = register_admin(client, f"{unique}b")
    collab_b = create_collaborator(client, admin_b["access_token"], f"{unique}b")

    fetched = client.get(
        f"/users/{collab_b['user']['id']}",
        headers=auth_header(admin_a["access_token"]),
    )
    assert fetched.status_code == 404

    updated = client.patch(
        f"/users/{collab_b['user']['id']}",
        json={"name": "Intruso"},
        headers=auth_header(admin_a["access_token"]),
    )
    assert updated.status_code == 404


def test_admin_cannot_see_other_organization_project(client, unique):
    admin_a = register_admin(client, f"{unique}a")
    admin_b = register_admin(client, f"{unique}b")
    project = client.post(
        "/projects",
        json={"name": f"Projeto B {unique}"},
        headers=auth_header(admin_b["access_token"]),
    ).json()

    listed = client.get("/projects", headers=auth_header(admin_a["access_token"]))
    assert listed.status_code == 200
    ids = {item["id"] for item in listed.json()}
    assert project["id"] not in ids

    opened = client.get(
        f"/projects/{project['id']}",
        headers=auth_header(admin_a["access_token"]),
    )
    assert opened.status_code == 404


def test_cannot_add_member_from_other_organization(client, unique):
    admin_a = register_admin(client, f"{unique}a")
    admin_b = register_admin(client, f"{unique}b")
    collab_b = create_collaborator(client, admin_b["access_token"], f"{unique}b")
    project = client.post(
        "/projects",
        json={"name": f"Projeto A {unique}"},
        headers=auth_header(admin_a["access_token"]),
    ).json()

    added = client.post(
        f"/projects/{project['id']}/members",
        json={"user_id": collab_b["user"]["id"]},
        headers=auth_header(admin_a["access_token"]),
    )
    assert added.status_code == 404


def test_last_admin_is_scoped_to_organization(client, unique):
    admin_a = register_admin(client, f"{unique}a")
    register_admin(client, f"{unique}b")

    demote = client.patch(
        f"/users/{admin_a['user']['id']}",
        json={"role": "COLLABORATOR"},
        headers=auth_header(admin_a["access_token"]),
    )
    assert demote.status_code == 409
    assert "último administrador" in demote.json()["message"]
