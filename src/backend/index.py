from __future__ import annotations
import asyncio
from contextlib import asynccontextmanager

from fastapi.middleware.cors import CORSMiddleware
from starlette import status
from starlette.websockets import WebSocket
import uvicorn

from api.session import Session
from api.websocket import websocket_manager
from api.config import config
from api.docs import init_custom_docs
from api.middleware import ocel_access_middleware
from api.utils import (
    custom_snake2camel,
    error_handler_server,
    verify_parameter_alias_consistency,
)
from ocel.default_ocel import (
    load_default_ocels,
)
from registrar import register_modules, register_initial_plugins

from fastapi import FastAPI
from routes import routes
from version import __version__
from api.logger import LOGGER_CONFIG

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
    allow_credentials=True,  # enable cookies
    allow_methods=["*"],
    allow_headers=["*"],
)
app.middleware("http")(ocel_access_middleware)

# Error handler for internal server errors
app.exception_handler(Exception)(error_handler_server)

register_modules(app)
register_initial_plugins()

for route in routes:
    app.include_router(route)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    session_id = websocket.cookies.get(config.SESSION_ID_HEADER)

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


def post_init_tasks():
    """Non-blocking tasks to be executed after the API has been initialized"""

    # Verify parameter aliases are consistent
    verify_parameter_alias_consistency(app, custom_snake2camel)


post_init_tasks()

if __name__ == "__main__":
    uvicorn.run(
        "index:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_config=LOGGER_CONFIG,
    )
