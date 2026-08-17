from tests.conftest import auth_header, create_collaborator, register_admin


def test_collaborator_cannot_create_user(client, unique):
    admin = register_admin(client, unique)
    collab = create_collaborator(client, admin["access_token"], unique)
    response = client.post(
        "/users",
        json={
            "username": f"wh_new_{unique}",
            "name": "Novo",
            "password": "senha1234",
            "role": "COLLABORATOR",
        },
        headers=auth_header(collab["access_token"]),
    )
    assert response.status_code == 403


def test_collaborator_cannot_manage_members(client, unique):
    admin = register_admin(client, unique)
    owner = create_collaborator(client, admin["access_token"], unique, "own")
    other = create_collaborator(client, admin["access_token"], unique, "oth")
    project = client.post(
        "/projects",
        json={"name": f"Projeto membros {unique}"},
        headers=auth_header(admin["access_token"]),
    ).json()
    client.post(
        f"/projects/{project['id']}/members",
        json={"user_id": owner["user"]["id"]},
        headers=auth_header(admin["access_token"]),
    )

    added = client.post(
        f"/projects/{project['id']}/members",
        json={"user_id": other["user"]["id"]},
        headers=auth_header(owner["access_token"]),
    )
    assert added.status_code == 403

    by_admin = client.post(
        f"/projects/{project['id']}/members",
        json={"user_id": other["user"]["id"]},
        headers=auth_header(admin["access_token"]),
    )
    assert by_admin.status_code == 201, by_admin.text

    removed = client.delete(
        f"/projects/{project['id']}/members/{other['user']['id']}",
        headers=auth_header(owner["access_token"]),
    )
    assert removed.status_code == 403


def test_admin_overview_summarizes_tasks(client, unique):
    admin = register_admin(client, unique)
    collab = create_collaborator(client, admin["access_token"], unique)
    project = client.post(
        "/projects",
        json={"name": f"Projeto overview {unique}"},
        headers=auth_header(admin["access_token"]),
    ).json()
    client.post(
        f"/projects/{project['id']}/members",
        json={"user_id": collab["user"]["id"]},
        headers=auth_header(admin["access_token"]),
    )
    client.post(
        f"/projects/{project['id']}/tasks",
        json={"title": "Ativa", "assigned_user_id": collab["user"]["id"]},
        headers=auth_header(admin["access_token"]),
    )
    done = client.post(
        f"/projects/{project['id']}/tasks",
        json={"title": "Feita", "assigned_user_id": collab["user"]["id"], "status": "DONE"},
        headers=auth_header(admin["access_token"]),
    )
    assert done.status_code == 201, done.text

    forbidden = client.get("/projects/overview", headers=auth_header(collab["access_token"]))
    assert forbidden.status_code == 403

    overview = client.get("/projects/overview", headers=auth_header(admin["access_token"]))
    assert overview.status_code == 200, overview.text
    body = overview.json()
    assert body["project_count"] >= 1
    assert body["total"] >= 2
    assert body["done"] >= 1
    assert body["active"] >= 1
    assert body["storage_used_bytes"] == 0
    assert body["storage_file_count"] == 0
    assert body["storage_quota_bytes"] > 0
    person = next(item for item in body["contributors"] if item["user_id"] == collab["user"]["id"])
    assert person["done"] >= 1
    assert person["todo"] >= 1


def test_collaborator_cannot_create_project(client, unique):
    admin = register_admin(client, unique)
    collab = create_collaborator(client, admin["access_token"], unique)
    response = client.post(
        "/projects",
        json={"name": f"Projeto collab {unique}", "description": "ok"},
        headers=auth_header(collab["access_token"]),
    )
    assert response.status_code == 403


def test_outsider_cannot_access_messages(client, unique):
    admin = register_admin(client, unique)
    member = create_collaborator(client, admin["access_token"], unique, "in")
    outsider = create_collaborator(client, admin["access_token"], unique, "out")

    project = client.post(
        "/projects",
        json={"name": f"Projeto {unique}", "description": "chat"},
        headers=auth_header(admin["access_token"]),
    ).json()

    client.post(
        f"/projects/{project['id']}/members",
        json={"user_id": member["user"]["id"]},
        headers=auth_header(admin["access_token"]),
    )

    response = client.get(
        f"/projects/{project['id']}/messages",
        headers=auth_header(outsider["access_token"]),
    )
    assert response.status_code == 403


def test_outsider_cannot_access_tasks(client, unique):
    admin = register_admin(client, unique)
    outsider = create_collaborator(client, admin["access_token"], unique, "out")
    project = client.post(
        "/projects",
        json={"name": f"Projeto tasks {unique}"},
        headers=auth_header(admin["access_token"]),
    ).json()

    response = client.get(
        f"/projects/{project['id']}/tasks",
        headers=auth_header(outsider["access_token"]),
    )
    assert response.status_code == 403


def test_cannot_assign_task_to_non_member(client, unique):
    admin = register_admin(client, unique)
    outsider = create_collaborator(client, admin["access_token"], unique, "out")
    project = client.post(
        "/projects",
        json={"name": f"Projeto assign {unique}"},
        headers=auth_header(admin["access_token"]),
    ).json()

    response = client.post(
        f"/projects/{project['id']}/tasks",
        json={
            "title": "Tarefa inválida",
            "assigned_user_id": outsider["user"]["id"],
        },
        headers=auth_header(admin["access_token"]),
    )
    assert response.status_code == 403
    assert "participar do projeto" in response.json()["message"]


def test_collaborator_can_manage_any_task_in_project(client, unique):
    admin = register_admin(client, unique)
    owner = create_collaborator(client, admin["access_token"], unique, "own")
    other = create_collaborator(client, admin["access_token"], unique, "oth")

    project = client.post(
        "/projects",
        json={"name": f"Projeto perms {unique}"},
        headers=auth_header(admin["access_token"]),
    ).json()

    for user in (owner, other):
        added = client.post(
            f"/projects/{project['id']}/members",
            json={"user_id": user["user"]["id"]},
            headers=auth_header(admin["access_token"]),
        )
        assert added.status_code == 201, added.text

    created = client.post(
        f"/projects/{project['id']}/tasks",
        json={"title": "Tarefa do owner", "assigned_user_id": owner["user"]["id"]},
        headers=auth_header(other["access_token"]),
    )
    assert created.status_code == 201, created.text
    task = created.json()

    response = client.patch(
        f"/projects/{project['id']}/tasks/{task['id']}",
        json={"title": "Tarefa atualizada", "status": "DONE"},
        headers=auth_header(other["access_token"]),
    )
    assert response.status_code == 200, response.text
    assert response.json()["title"] == "Tarefa atualizada"
    assert response.json()["status"] == "DONE"


def test_admin_can_manage_task(client, unique):
    admin = register_admin(client, unique)
    collab = create_collaborator(client, admin["access_token"], unique)
    project = client.post(
        "/projects",
        json={"name": f"Projeto admin task {unique}"},
        headers=auth_header(admin["access_token"]),
    ).json()
    client.post(
        f"/projects/{project['id']}/members",
        json={"user_id": collab["user"]["id"]},
        headers=auth_header(admin["access_token"]),
    )

    created = client.post(
        f"/projects/{project['id']}/tasks",
        json={
            "title": "Documentar API",
            "description": "Atualizar README",
            "assigned_user_id": collab["user"]["id"],
        },
        headers=auth_header(admin["access_token"]),
    )
    assert created.status_code == 201, created.text
    task = created.json()

    updated = client.patch(
        f"/projects/{project['id']}/tasks/{task['id']}",
        json={"title": "Documentar API v2", "status": "IN_PROGRESS"},
        headers=auth_header(admin["access_token"]),
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Documentar API v2"
    assert updated.json()["status"] == "IN_PROGRESS"

    by_owner = client.patch(
        f"/projects/{project['id']}/tasks/{task['id']}",
        json={"status": "DONE"},
        headers=auth_header(collab["access_token"]),
    )
    assert by_owner.status_code == 200
    assert by_owner.json()["status"] == "DONE"


def test_task_order_can_be_rearranged(client, unique):
    admin = register_admin(client, unique)
    project = client.post(
        "/projects",
        json={"name": f"Projeto ordem {unique}"},
        headers=auth_header(admin["access_token"]),
    ).json()

    created = []
    for title in ("Primeira", "Segunda", "Terceira"):
        response = client.post(
            f"/projects/{project['id']}/tasks",
            json={"title": title, "assigned_user_id": admin["user"]["id"]},
            headers=auth_header(admin["access_token"]),
        )
        assert response.status_code == 201, response.text
        created.append(response.json())

    first, second, third = created
    moved = client.patch(
        f"/projects/{project['id']}/tasks/{third['id']}",
        json={"status": "TODO", "position": 0},
        headers=auth_header(admin["access_token"]),
    )
    assert moved.status_code == 200, moved.text

    board = client.get(
        f"/projects/{project['id']}/tasks",
        headers=auth_header(admin["access_token"]),
    ).json()
    todo = sorted(
        [item for item in board if item["status"] == "TODO"],
        key=lambda item: item["position"],
    )
    assert [item["title"] for item in todo] == ["Terceira", "Primeira", "Segunda"]

    to_progress = client.patch(
        f"/projects/{project['id']}/tasks/{first['id']}",
        json={"status": "IN_PROGRESS", "position": 0},
        headers=auth_header(admin["access_token"]),
    )
    assert to_progress.status_code == 200
    board = client.get(
        f"/projects/{project['id']}/tasks",
        headers=auth_header(admin["access_token"]),
    ).json()
    todo = sorted(
        [item for item in board if item["status"] == "TODO"],
        key=lambda item: item["position"],
    )
    progress = sorted(
        [item for item in board if item["status"] == "IN_PROGRESS"],
        key=lambda item: item["position"],
    )
    assert [item["title"] for item in todo] == ["Terceira", "Segunda"]
    assert [item["title"] for item in progress] == ["Primeira"]
