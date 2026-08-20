from tests.conftest import auth_header, create_collaborator, register_admin


def test_unread_count_appears_after_messages_without_open_socket(client, unique):
    admin = register_admin(client, unique)
    member = create_collaborator(client, admin["access_token"], unique, "un")
    admin_headers = auth_header(admin["access_token"])
    member_headers = auth_header(member["access_token"])

    project = client.post(
        "/projects",
        json={"name": f"Landing Page {unique}"},
        headers=admin_headers,
    ).json()
    added = client.post(
        f"/projects/{project['id']}/members",
        json={"user_id": member["user"]["id"]},
        headers=admin_headers,
    )
    assert added.status_code == 201, added.text

    first = client.post(
        f"/projects/{project['id']}/messages",
        json={"content": "primeira"},
        headers=admin_headers,
    )
    assert first.status_code == 201, first.text
    second = client.post(
        f"/projects/{project['id']}/messages",
        json={"content": "segunda"},
        headers=admin_headers,
    )
    assert second.status_code == 201, second.text

    listed = client.get("/projects", headers=member_headers)
    assert listed.status_code == 200, listed.text
    item = next(row for row in listed.json() if row["id"] == project["id"])
    assert item["unread_count"] == 2

    marked = client.post(f"/projects/{project['id']}/read", headers=member_headers)
    assert marked.status_code == 204, marked.text

    listed = client.get("/projects", headers=member_headers)
    item = next(row for row in listed.json() if row["id"] == project["id"])
    assert item["unread_count"] == 0

    later = client.post(
        f"/projects/{project['id']}/messages",
        json={"content": "depois de ler"},
        headers=admin_headers,
    )
    assert later.status_code == 201, later.text

    listed = client.get("/projects", headers=member_headers)
    item = next(row for row in listed.json() if row["id"] == project["id"])
    assert item["unread_count"] == 1


def test_own_messages_do_not_count_as_unread(client, unique):
    admin = register_admin(client, unique)
    headers = auth_header(admin["access_token"])
    project = client.post(
        "/projects",
        json={"name": f"Projeto proprio {unique}"},
        headers=headers,
    ).json()
    created = client.post(
        f"/projects/{project['id']}/messages",
        json={"content": "eu mesmo"},
        headers=headers,
    )
    assert created.status_code == 201, created.text

    listed = client.get("/projects", headers=headers)
    item = next(row for row in listed.json() if row["id"] == project["id"])
    assert item["unread_count"] == 0
