import asyncio
from collections import defaultdict
from typing import Any, Iterable

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._rooms: dict[str, dict[WebSocket, int]] = defaultdict(dict)
        self._user_sockets: dict[int, set[WebSocket]] = defaultdict(set)
        self._loop: asyncio.AbstractEventLoop | None = None

    def _key(self, group_id: int) -> str:
        return str(group_id)

    def _remember_loop(self) -> asyncio.AbstractEventLoop | None:
        if self._loop is not None and self._loop.is_running():
            return self._loop
        try:
            self._loop = asyncio.get_running_loop()
        except RuntimeError:
            return self._loop
        return self._loop

    async def connect(self, group_id: int, websocket: WebSocket, user_id: int) -> None:
        self._remember_loop()
        await websocket.accept()
        self._rooms[self._key(group_id)][websocket] = user_id

    async def connect_user(self, user_id: int, websocket: WebSocket) -> None:
        self._remember_loop()
        await websocket.accept()
        self._user_sockets[user_id].add(websocket)

    def disconnect(self, group_id: int, websocket: WebSocket) -> None:
        room = self._rooms.get(self._key(group_id))
        if room is None:
            return
        room.pop(websocket, None)
        if not room:
            self._rooms.pop(self._key(group_id), None)

    def disconnect_personal(self, user_id: int, websocket: WebSocket) -> None:
        sockets = self._user_sockets.get(user_id)
        if sockets is None:
            return
        sockets.discard(websocket)
        if not sockets:
            self._user_sockets.pop(user_id, None)

    def disconnect_room(self, group_id: int) -> None:
        key = self._key(group_id)
        room = self._rooms.pop(key, None)
        if not room:
            return
        loop = self._remember_loop()
        for websocket in list(room.keys()):
            if loop is not None:
                asyncio.run_coroutine_threadsafe(websocket.close(code=4003), loop)

    def disconnect_user(self, group_id: int, user_id: int) -> None:
        key = self._key(group_id)
        room = self._rooms.get(key)
        if room is None:
            return
        to_close = [ws for ws, uid in room.items() if uid == user_id]
        loop = self._remember_loop()
        for websocket in to_close:
            room.pop(websocket, None)
            if loop is not None:
                asyncio.run_coroutine_threadsafe(websocket.close(code=4003), loop)
        if not room:
            self._rooms.pop(key, None)

    async def broadcast(self, group_id: int, data: dict[str, Any]) -> None:
        room = self._rooms.get(self._key(group_id), {})
        stale: list[WebSocket] = []
        for websocket in list(room.keys()):
            try:
                await websocket.send_json(data)
            except Exception:
                stale.append(websocket)
        for websocket in stale:
            self.disconnect(group_id, websocket)

    def broadcast_nowait(self, group_id: int, data: dict[str, Any]) -> None:
        loop = self._remember_loop()
        if loop is None or not loop.is_running():
            return
        asyncio.run_coroutine_threadsafe(self.broadcast(group_id, data), loop)

    async def notify_users(self, user_ids: Iterable[int], data: dict[str, Any]) -> None:
        seen: set[int] = set()
        for user_id in user_ids:
            if user_id in seen:
                continue
            seen.add(user_id)
            stale: list[WebSocket] = []
            for websocket in list(self._user_sockets.get(user_id, ())):
                try:
                    await websocket.send_json(data)
                except Exception:
                    stale.append(websocket)
            for websocket in stale:
                self.disconnect_personal(user_id, websocket)

    def notify_users_nowait(self, user_ids: Iterable[int], data: dict[str, Any]) -> None:
        loop = self._remember_loop()
        if loop is None or not loop.is_running():
            return
        asyncio.run_coroutine_threadsafe(self.notify_users(user_ids, data), loop)


connection_manager = ConnectionManager()
