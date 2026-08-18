import pytest

from tests.conftest import auth_header, create_collaborator, register_admin


def test_outsider_cannot_connect_websocket(client, unique):
    admin = register_admin(client, unique)
    outsider = create_collaborator(client, admin["access_token"], unique, "ws")
    project = client.post(
        "/projects",
        json={"name": f"Projeto ws {unique}"},
        headers=auth_header(admin["access_token"]),
    ).json()

    with pytest.raises(Exception):
        with client.websocket_connect(
            f"/ws/projects/{project['id']}?token={outsider['access_token']}"
        ) as websocket:
            websocket.receive_json()


def test_member_is_notified_without_being_in_project_room(client, unique):
    admin = register_admin(client, unique)
    member = create_collaborator(client, admin["access_token"], unique, "in")
    project = client.post(
        "/projects",
        json={"name": f"Projeto aviso {unique}"},
        headers=auth_header(admin["access_token"]),
    ).json()
    added = client.post(
        f"/projects/{project['id']}/members",
        json={"user_id": member["user"]["id"]},
        headers=auth_header(admin["access_token"]),
    )
    assert added.status_code == 201, added.text

    with client.websocket_connect(f"/ws/notifications?token={member['access_token']}") as websocket:
        created = client.post(
            f"/projects/{project['id']}/messages",
            json={"content": "Tem alguém aí?"},
            headers=auth_header(admin["access_token"]),
        )
        assert created.status_code == 201, created.text
        event = websocket.receive_json()
        assert event["type"] == "message"
        assert event["payload"]["content"] == "Tem alguém aí?"
        assert event["payload"]["project_id"] == project["id"]
        assert event["payload"]["reply_to"] is None
        assert event["project_name"] == project["name"]
