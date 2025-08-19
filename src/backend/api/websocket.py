import asyncio
from typing import Annotated, Literal, Optional, Union
from fastapi import WebSocket
from pydantic.fields import Field
from pydantic.main import BaseModel


class OcelLink(BaseModel):
    type: Literal["ocel"] = "ocel"
    ocel_id: str


class ResourceLink(BaseModel):
    type: Literal["resource"] = "resource"
    resource_id: str


class PluginLink(BaseModel):
    type: Literal["plugin"] = "plugin"
    name: str
    method: str
    task_id: str


SystemLink = Annotated[
    Union[OcelLink, PluginLink, ResourceLink], Field(discriminator="type")
]


class SytemNotificiation(BaseModel):
    type: Literal["notification"] = "notification"
    title: str
    message: str
    notification_type: Literal["warning", "info", "error"]
    link: Optional[SystemLink] = None


class InvalidationRequest(BaseModel):
    type: Literal["invalidation"] = "invalidation"
    routes: list[Literal["resources", "ocels", "tasks", "plugins"]]


WebsocketMessage = Annotated[
    Union[SytemNotificiation, InvalidationRequest], Field(discriminator="type")
]


class WebSocketManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
        self.loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop):
        self.loop = loop

    def connect(self, session_id: str, websocket: WebSocket):
        self.active_connections[session_id] = websocket

    def disconnect(self, session_id: str):
        self.active_connections.pop(session_id, None)

    async def send(self, session_id: str, message: WebsocketMessage):
        ws = self.active_connections.get(session_id)
        if ws:
            await ws.send_json(message.model_dump())

    async def broadcast(self, message: str):
        for ws in self.active_connections.values():
            await ws.send_text(message)

    def is_connected(self, session_id: str) -> bool:
        return session_id in self.active_connections

    def send_safe(self, session_id: str, message: WebsocketMessage):
        """Call from sync/threaded context."""
        if not self.loop:
            raise RuntimeError("Event loop not set on WebSocketManager")
        coro = self.send(session_id, message)
        asyncio.run_coroutine_threadsafe(coro, self.loop)


websocket_manager = WebSocketManager()
