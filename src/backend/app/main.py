from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

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
from app.sse_manager import sse_manager
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


@app.get("/sse")
async def sse_endpoint(request: Request):
    session_id = request.query_params.get("session_id")

    if not session_id:
        return StreamingResponse(
            iter(["data: Missing session_id\n\n"]), media_type="text/event-stream"
        )

    queue = await sse_manager.connect(session_id)
    print(f"✅ SSE connected for session: {session_id}")

    async def event_stream():
        try:
            while True:
                if await request.is_disconnected():
                    print(f"❌ SSE disconnected for session: {session_id}")
                    sse_manager.disconnect(session_id)
                    break

                # Wait for next message
                msg = await queue.get()
                yield f"data: {msg}\n\n"
        except asyncio.CancelledError:
            sse_manager.disconnect(session_id)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


init_custom_docs(app)
