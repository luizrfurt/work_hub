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


def test_member_can_read_storage_usage(client, unique):
    admin = register_admin(client, unique)
    collab = create_collaborator(client, admin["access_token"], unique)

    forbidden = client.get("/projects/overview", headers=auth_header(collab["access_token"]))
    assert forbidden.status_code == 403

    usage = client.get("/projects/storage", headers=auth_header(collab["access_token"]))
    assert usage.status_code == 200, usage.text
    body = usage.json()
    assert body["storage_used_bytes"] == 0
    assert body["storage_file_count"] == 0
    assert body["storage_quota_bytes"] > 0


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


def test_author_can_edit_and_delete_own_message(client, unique):
    admin = register_admin(client, unique)
    author = create_collaborator(client, admin["access_token"], unique, "au")
    other = create_collaborator(client, admin["access_token"], unique, "ot")
    project = client.post(
        "/projects",
        json={"name": f"Projeto chat edit {unique}"},
        headers=auth_header(admin["access_token"]),
    ).json()
    for member in (author, other):
        client.post(
            f"/projects/{project['id']}/members",
            json={"user_id": member["user"]["id"]},
            headers=auth_header(admin["access_token"]),
        )

    created = client.post(
        f"/projects/{project['id']}/messages",
        json={"content": "Texto original"},
        headers=auth_header(author["access_token"]),
    )
    assert created.status_code == 201, created.text
    message = created.json()

    forbidden_edit = client.patch(
        f"/projects/{project['id']}/messages/{message['id']}",
        json={"content": "Não é sua"},
        headers=auth_header(other["access_token"]),
    )
    assert forbidden_edit.status_code == 403

    edited = client.patch(
        f"/projects/{project['id']}/messages/{message['id']}",
        json={"content": "Texto corrigido"},
        headers=auth_header(author["access_token"]),
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["content"] == "Texto corrigido"
    assert edited.json()["updated_at"] >= edited.json()["created_at"]
    assert "previous_content" not in edited.json()

    from app.database.connection import SessionLocal
    from app.models.message import Message

    db = SessionLocal()
    try:
        stored = db.get(Message, message["id"])
        assert stored is not None
        assert stored.content == "Texto corrigido"
        assert stored.previous_content == "Texto original"
        assert stored.deleted_at is None
    finally:
        db.close()

    forbidden_delete = client.delete(
        f"/projects/{project['id']}/messages/{message['id']}",
        headers=auth_header(other["access_token"]),
    )
    assert forbidden_delete.status_code == 403

    deleted = client.delete(
        f"/projects/{project['id']}/messages/{message['id']}",
        headers=auth_header(author["access_token"]),
    )
    assert deleted.status_code == 200, deleted.text
    body = deleted.json()
    assert body["id"] == message["id"]
    assert body["deleted_at"] is not None
    assert body["content"] is None
    assert body["attachments"] == []

    listed = client.get(
        f"/projects/{project['id']}/messages",
        headers=auth_header(author["access_token"]),
    ).json()
    tombstone = next(item for item in listed["items"] if item["id"] == message["id"])
    assert tombstone["deleted_at"] is not None
    assert tombstone["content"] is None
    assert "previous_content" not in tombstone

    db = SessionLocal()
    try:
        stored = db.get(Message, message["id"])
        assert stored is not None
        assert stored.deleted_at is not None
        assert stored.content == "Texto corrigido"
        assert stored.previous_content == "Texto original"
    finally:
        db.close()


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


def test_member_can_attach_file_to_task(client, unique):
    admin = register_admin(client, unique)
    collab = create_collaborator(client, admin["access_token"], unique)
    project = client.post(
        "/projects",
        json={"name": f"Projeto anexo {unique}"},
        headers=auth_header(admin["access_token"]),
    ).json()
    client.post(
        f"/projects/{project['id']}/members",
        json={"user_id": collab["user"]["id"]},
        headers=auth_header(admin["access_token"]),
    )
    task = client.post(
        f"/projects/{project['id']}/tasks",
        json={"title": "Com anexo", "assigned_user_id": collab["user"]["id"]},
        headers=auth_header(admin["access_token"]),
    ).json()
    assert task["attachments"] == []

    uploaded = client.post(
        f"/projects/{project['id']}/tasks/{task['id']}/attachments",
        files={"file": ("nota.txt", b"texto da tarefa", "text/plain")},
        headers=auth_header(collab["access_token"]),
    )
    assert uploaded.status_code == 201, uploaded.text
    body = uploaded.json()
    assert len(body["attachments"]) == 1
    assert body["attachments"][0]["original_name"] == "nota.txt"
    assert body["attachments"][0]["mime_type"] == "text/plain"

    attachment_id = body["attachments"][0]["id"]
    download = client.get(
        f"/projects/{project['id']}/tasks/{task['id']}/attachments/{attachment_id}",
        headers=auth_header(collab["access_token"]),
    )
    assert download.status_code == 200
    assert download.content == b"texto da tarefa"


def test_outsider_cannot_attach_file_to_task(client, unique):
    admin = register_admin(client, unique)
    outsider = create_collaborator(client, admin["access_token"], unique, "out")
    project = client.post(
        "/projects",
        json={"name": f"Projeto anexo fora {unique}"},
        headers=auth_header(admin["access_token"]),
    ).json()
    task = client.post(
        f"/projects/{project['id']}/tasks",
        json={"title": "Sem outsider", "assigned_user_id": admin["user"]["id"]},
        headers=auth_header(admin["access_token"]),
    ).json()

    response = client.post(
        f"/projects/{project['id']}/tasks/{task['id']}/attachments",
        files={"file": ("nota.txt", b"nao", "text/plain")},
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


def test_only_admin_or_assignee_can_manage_task(client, unique):
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

    forbidden = client.patch(
        f"/projects/{project['id']}/tasks/{task['id']}",
        json={"title": "Tarefa atualizada", "status": "DONE"},
        headers=auth_header(other["access_token"]),
    )
    assert forbidden.status_code == 403

    by_owner = client.patch(
        f"/projects/{project['id']}/tasks/{task['id']}",
        json={"title": "Tarefa atualizada", "status": "DONE"},
        headers=auth_header(owner["access_token"]),
    )
    assert by_owner.status_code == 200, by_owner.text
    assert by_owner.json()["title"] == "Tarefa atualizada"
    assert by_owner.json()["status"] == "DONE"


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


def test_only_admin_can_delete_task(client, unique):
    admin = register_admin(client, unique)
    collab = create_collaborator(client, admin["access_token"], unique)
    project = client.post(
        "/projects",
        json={"name": f"Projeto apagar tarefa {unique}"},
        headers=auth_header(admin["access_token"]),
    ).json()
    client.post(
        f"/projects/{project['id']}/members",
        json={"user_id": collab["user"]["id"]},
        headers=auth_header(admin["access_token"]),
    )
    task = client.post(
        f"/projects/{project['id']}/tasks",
        json={"title": "Apagar", "assigned_user_id": collab["user"]["id"]},
        headers=auth_header(collab["access_token"]),
    ).json()

    forbidden = client.delete(
        f"/projects/{project['id']}/tasks/{task['id']}",
        headers=auth_header(collab["access_token"]),
    )
    assert forbidden.status_code == 403

    deleted = client.delete(
        f"/projects/{project['id']}/tasks/{task['id']}",
        headers=auth_header(admin["access_token"]),
    )
    assert deleted.status_code == 204, deleted.text

    missing = client.get(
        f"/projects/{project['id']}/tasks/{task['id']}",
        headers=auth_header(admin["access_token"]),
    )
    assert missing.status_code == 404


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


def test_member_can_reply_to_message(client, unique):
    admin = register_admin(client, unique)
    author = create_collaborator(client, admin["access_token"], unique, "au")
    other = create_collaborator(client, admin["access_token"], unique, "ot")
    project = client.post(
        "/projects",
        json={"name": f"Projeto reply {unique}"},
        headers=auth_header(admin["access_token"]),
    ).json()
    other_project = client.post(
        "/projects",
        json={"name": f"Projeto reply fora {unique}"},
        headers=auth_header(admin["access_token"]),
    ).json()
    for member in (author, other):
        client.post(
            f"/projects/{project['id']}/members",
            json={"user_id": member["user"]["id"]},
            headers=auth_header(admin["access_token"]),
        )

    original = client.post(
        f"/projects/{project['id']}/messages",
        json={"content": "Pergunta original"},
        headers=auth_header(author["access_token"]),
    )
    assert original.status_code == 201, original.text
    original_id = original.json()["id"]
    assert original.json()["reply_to"] is None

    missing = client.post(
        f"/projects/{project['id']}/messages",
        json={"content": "Sem original", "reply_to_id": 9_999_999},
        headers=auth_header(other["access_token"]),
    )
    assert missing.status_code == 404

    cross = client.post(
        f"/projects/{other_project['id']}/messages",
        json={"content": "Outro projeto", "reply_to_id": original_id},
        headers=auth_header(admin["access_token"]),
    )
    assert cross.status_code == 404

    replied = client.post(
        f"/projects/{project['id']}/messages",
        json={"content": "Resposta", "reply_to_id": original_id},
        headers=auth_header(other["access_token"]),
    )
    assert replied.status_code == 201, replied.text
    body = replied.json()
    assert body["content"] == "Resposta"
    assert body["reply_to"]["id"] == original_id
    assert body["reply_to"]["author_name"] == author["user"]["name"]
    assert body["reply_to"]["content"] == "Pergunta original"
    assert body["reply_to"]["deleted"] is False
    assert body["reply_to"]["has_attachment"] is False

    edited = client.patch(
        f"/projects/{project['id']}/messages/{original_id}",
        json={"content": "Pergunta editada"},
        headers=auth_header(author["access_token"]),
    )
    assert edited.status_code == 200, edited.text

    listed = client.get(
        f"/projects/{project['id']}/messages",
        headers=auth_header(other["access_token"]),
    ).json()
    quote = next(item for item in listed["items"] if item["id"] == body["id"])
    assert quote["reply_to"]["content"] == "Pergunta editada"

    deleted = client.delete(
        f"/projects/{project['id']}/messages/{original_id}",
        headers=auth_header(author["access_token"]),
    )
    assert deleted.status_code == 200, deleted.text

    listed = client.get(
        f"/projects/{project['id']}/messages",
        headers=auth_header(other["access_token"]),
    ).json()
    quote = next(item for item in listed["items"] if item["id"] == body["id"])
    assert quote["reply_to"]["deleted"] is True
    assert quote["reply_to"]["content"] is None

    blocked = client.post(
        f"/projects/{project['id']}/messages",
        json={"content": "Tarde demais", "reply_to_id": original_id},
        headers=auth_header(other["access_token"]),
    )
    assert blocked.status_code == 400
    assert "excluída" in blocked.json()["message"]
