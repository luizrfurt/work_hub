from tests.conftest import auth_header, create_collaborator, register_admin


def test_projects_keep_creation_order(client, unique):
    admin = register_admin(client, unique)
    headers = auth_header(admin["access_token"])
    first = client.post(
        "/projects",
        json={"name": f"Zulu {unique}", "description": "depois"},
        headers=headers,
    )
    second = client.post(
        "/projects",
        json={"name": f"Alfa {unique}", "description": "antes"},
        headers=headers,
    )
    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text

    listed = client.get("/projects", headers=headers)
    assert listed.status_code == 200, listed.text
    ids = [item["id"] for item in listed.json()]
    assert ids.index(first.json()["id"]) < ids.index(second.json()["id"])


def test_admin_can_rename_project(client, unique):
    admin = register_admin(client, unique)
    headers = auth_header(admin["access_token"])
    project = client.post(
        "/projects",
        json={"name": f"Nome antigo {unique}", "description": "texto"},
        headers=headers,
    ).json()

    updated = client.patch(
        f"/projects/{project['id']}",
        json={"name": f"Nome novo {unique}"},
        headers=headers,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == f"Nome novo {unique}"
    assert updated.json()["description"] == "texto"

    cleared = client.patch(
        f"/projects/{project['id']}",
        json={"description": ""},
        headers=headers,
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["description"] is None


def test_collaborator_cannot_update_or_delete_project(client, unique):
    admin = register_admin(client, unique)
    collab = create_collaborator(client, admin["access_token"], unique)
    project = client.post(
        "/projects",
        json={"name": f"Projeto lock {unique}"},
        headers=auth_header(admin["access_token"]),
    ).json()
    client.post(
        f"/projects/{project['id']}/members",
        json={"user_id": collab["user"]["id"]},
        headers=auth_header(admin["access_token"]),
    )

    renamed = client.patch(
        f"/projects/{project['id']}",
        json={"name": "Tentativa"},
        headers=auth_header(collab["access_token"]),
    )
    assert renamed.status_code == 403

    deleted = client.delete(
        f"/projects/{project['id']}",
        headers=auth_header(collab["access_token"]),
    )
    assert deleted.status_code == 403


def test_admin_can_delete_project(client, unique):
    admin = register_admin(client, unique)
    collab = create_collaborator(client, admin["access_token"], unique)
    headers = auth_header(admin["access_token"])
    project = client.post(
        "/projects",
        json={"name": f"Projeto apagar {unique}"},
        headers=headers,
    ).json()
    client.post(
        f"/projects/{project['id']}/members",
        json={"user_id": collab["user"]["id"]},
        headers=headers,
    )
    task = client.post(
        f"/projects/{project['id']}/tasks",
        json={"title": "Tarefa", "assigned_user_id": collab["user"]["id"]},
        headers=headers,
    )
    assert task.status_code == 201, task.text

    deleted = client.delete(f"/projects/{project['id']}", headers=headers)
    assert deleted.status_code == 204, deleted.text

    missing = client.get(f"/projects/{project['id']}", headers=headers)
    assert missing.status_code == 404

    listed = client.get("/projects", headers=headers)
    assert project["id"] not in {item["id"] for item in listed.json()}


def test_admin_cannot_delete_other_organization_project(client, unique):
    admin_a = register_admin(client, f"{unique}a")
    admin_b = register_admin(client, f"{unique}b")
    project = client.post(
        "/projects",
        json={"name": f"Projeto B {unique}"},
        headers=auth_header(admin_b["access_token"]),
    ).json()

    deleted = client.delete(
        f"/projects/{project['id']}",
        headers=auth_header(admin_a["access_token"]),
    )
    assert deleted.status_code == 404
