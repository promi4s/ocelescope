from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterable

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.sse import EventSourceResponse

from app.internal.config import config
from app.internal.docs import init_custom_docs
from app.internal.ocel.default_ocel import (
    load_default_ocels,
)
from app.internal.registrar import register_initial_plugins, register_modules
from app.internal.utils import (
    error_handler_server,
)
from app.middleware import session_access_middleware
from app.routes import routes
from app.sse_manager import SSEMessage, sse_manager
from version import __version__


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_default_ocels()
    sse_manager.set_loop(asyncio.get_running_loop())
    yield


# Initialize FastAPI
app = FastAPI(
    title="Ocelescope Backend",
    version=__version__,
    docs_url=None,  # disable swagger docs, use rapidoc instead (call to init_custom_docs below)
    redoc_url=None,
    debug=True,
    lifespan=lifespan,
    redirect_slashes=False,
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


@app.get("/sse", response_class=EventSourceResponse, include_in_schema=False)
async def sse_endpoint(request: Request) -> AsyncIterable[SSEMessage]:
    session_id = request.query_params.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id")

    queue = await sse_manager.connect(session_id)

    try:
        while not await request.is_disconnected():
            yield await queue.get()
    finally:
        sse_manager.disconnect(session_id)


init_custom_docs(app)
