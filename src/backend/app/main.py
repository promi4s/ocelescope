from __future__ import annotations
import asyncio
from contextlib import asynccontextmanager

from fastapi.middleware.cors import CORSMiddleware
from starlette import status
from starlette.websockets import WebSocket

from api.session import Session
from api.websocket import websocket_manager
from api.config import config
from api.docs import init_custom_docs
from api.middleware import session_access_middleware
from api.utils import (
    error_handler_server,
)
from ocel.default_ocel import (
    load_default_ocels,
)
from registrar import register_modules, register_initial_plugins

from fastapi import FastAPI
from routes import routes
from version import __version__

"""
In this file, all API routes of the OCEAn application are defined.
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_default_ocels()
    websocket_manager.set_loop(asyncio.get_running_loop())
    yield  # ⬅️ this is the key line


# Initialize FastAPI
app = FastAPI(
    title="OCEAn",
    version=__version__,
    docs_url=None,  # disable swagger docs, use rapidoc instead (call to init_custom_docs below)
    redoc_url=None,
    debug=True,
    lifespan=lifespan,
)


origins = [config.FRONTEND_URL]  # Frontend origin

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[config.SESSION_ID_HEADER, "content-disposition"],
)
app.middleware("http")(session_access_middleware)

# Error handler for internal server errors
app.exception_handler(Exception)(error_handler_server)

register_modules(app)
register_initial_plugins()

for route in routes:
    app.include_router(route)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    session_id = websocket.query_params.get("session_id")

    session = Session.get(session_id) if session_id else None
    if session is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    websocket_manager.connect(session.id, websocket)
    print(f"✅ WebSocket connected for session: {session.id}")

    try:
        while True:
            await websocket.receive_text()  # keep alive
    except Exception:
        websocket_manager.disconnect(session.id)


init_custom_docs(app)
