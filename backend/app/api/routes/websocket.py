import json
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.exceptions import AppError, ForbiddenError, UnauthorizedError
from app.database.connection import SessionLocal
from app.models.user import User
from app.realtime.manager import connection_manager
from app.services.auth_service import AuthService
from app.services.message_service import MessageService
from app.services.project_service import ProjectService

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/notifications")
async def notifications_ws(
    websocket: WebSocket,
    token: str = Query(default=""),
) -> None:
    db = SessionLocal()
    try:
        if not token:
            raise UnauthorizedError("Não autenticado.")
        user = AuthService(db).get_user_from_access_token(token)
        user_id = user.id
    except (UnauthorizedError, ForbiddenError, AppError) as exc:
        await websocket.close(code=4001 if getattr(exc, "status_code", 403) == 401 else 4003)
        return
    finally:
        db.close()

    await connection_manager.connect_user(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connection_manager.disconnect_personal(user_id, websocket)
    finally:
        connection_manager.disconnect_personal(user_id, websocket)


@router.websocket("/ws/projects/{project_id}")
async def project_chat_ws(
    websocket: WebSocket,
    project_id: int,
    token: str = Query(default=""),
) -> None:
    db = SessionLocal()
    try:
        if not token:
            raise UnauthorizedError("Não autenticado.")
        user = AuthService(db).get_user_from_access_token(token)
        ProjectService(db).assert_can_access(project_id, user)
        user_id = user.id
    except (UnauthorizedError, ForbiddenError, AppError) as exc:
        await websocket.close(code=4001 if getattr(exc, "status_code", 403) == 401 else 4003)
        return
    finally:
        db.close()

    await connection_manager.connect(project_id, websocket, user_id)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                body = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "payload": {"message": "JSON inválido."}})
                continue

            content = (body.get("content") or "").strip()
            if not content:
                await websocket.send_json(
                    {"type": "error", "payload": {"message": "A mensagem não pode estar vazia."}}
                )
                continue

            message_db = SessionLocal()
            try:
                current_user = message_db.get(User, user_id)
                if current_user is None or not current_user.is_active:
                    await websocket.send_json(
                        {"type": "error", "payload": {"message": "Sessão inválida."}}
                    )
                    break
                MessageService(message_db).create_text_message(project_id, content, current_user)
            except AppError as exc:
                await websocket.send_json({"type": "error", "payload": {"message": exc.message}})
            finally:
                message_db.close()
    except WebSocketDisconnect:
        connection_manager.disconnect(project_id, websocket)
    finally:
        connection_manager.disconnect(project_id, websocket)
