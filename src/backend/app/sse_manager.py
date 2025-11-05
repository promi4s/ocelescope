import asyncio
import json
from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, Field


class OcelLink(BaseModel):
    type: Literal["ocel"] = "ocel"
    ocel_id: str


class ResourceLink(BaseModel):
    type: Literal["resource"] = "resource"
    resource_id: str


class PluginLink(BaseModel):
    type: Literal["plugin"] = "plugin"
    id: str
    method: str
    task_id: str


SystemLink = Annotated[
    Union[OcelLink, PluginLink, ResourceLink], Field(discriminator="type")
]


class SystemNotification(BaseModel):
    type: Literal["notification"] = "notification"
    title: str
    message: str
    notification_type: Literal["warning", "info", "error"]
    link: Optional[SystemLink] = None


class InvalidationRequest(BaseModel):
    type: Literal["invalidation"] = "invalidation"
    routes: list[Literal["resources", "ocels", "tasks", "plugins"]]


SSEMessage = Annotated[
    Union[SystemNotification, InvalidationRequest], Field(discriminator="type")
]


class SSEManager:
    def __init__(self):
        self.connections: dict[str, asyncio.Queue[str]] = {}
        self.loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop):
        """Store event loop reference for thread-safe sends."""
        self.loop = loop

    async def connect(self, session_id: str) -> asyncio.Queue[str]:
        """Create a message queue for the connected session."""
        queue = asyncio.Queue()
        self.connections[session_id] = queue
        return queue

    def disconnect(self, session_id: str):
        """Remove session connection."""
        self.connections.pop(session_id, None)

    async def send(self, session_id: str, message: SSEMessage):
        """Send JSON message to one client (async)."""
        queue = self.connections.get(session_id)
        if queue:
            await queue.put(json.dumps(message.model_dump()))

    async def broadcast(self, message: str):
        """Send plain text to all clients (async)."""
        for q in self.connections.values():
            await q.put(message)

    def send_safe(self, session_id: str, message: SSEMessage):
        """Thread-safe send for sync context."""
        if not self.loop:
            raise RuntimeError("Event loop not set on SSEManager")
        coro = self.send(session_id, message)
        asyncio.run_coroutine_threadsafe(coro, self.loop)

    def is_connected(self, session_id: str) -> bool:
        return session_id in self.connections


sse_manager = SSEManager()
