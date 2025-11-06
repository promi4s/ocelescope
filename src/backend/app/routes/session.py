from __future__ import annotations

import io
from datetime import datetime
from pathlib import Path

from fastapi import File, Request, UploadFile
from fastapi.responses import JSONResponse, Response
from fastapi.routing import APIRouter

from app.dependencies import ApiSession
from app.internal.config import config
from app.internal.session import Session
from app.internal.tasks.system_tasks import (
    import_ocel_task,
    import_plugin,
    import_resource,
)

session_router = APIRouter(prefix="/session", tags=["session"])


@session_router.post(
    "/upload", summary="Upload ocels, resources or tasks", operation_id="upload"
)
async def upload(session: ApiSession, files: list[UploadFile] = File(...)) -> list[str]:
    tasks = []
    for file in files:
        if file.filename is None:
            continue

        file_path = Path(file.filename)

        file_bytes = await file.read()
        file_stream = io.BytesIO(file_bytes)

        task_method = None
        match file_path.suffix:
            case ".zip":
                task_method = import_plugin
            case ".ocelescope":
                task_method = import_resource
            case _:
                if file_path.suffix in [
                    ".xml",
                    ".xmlocel",
                    ".json",
                    ".jsonocel",
                    ".sqlite",
                ]:
                    task_method = import_ocel_task

        if task_method is not None:
            tasks.append(
                task_method(
                    session=session,
                    file_stream=file_stream,
                    metadata={
                        "fileName": file_path.name,
                        "uploaded_at": datetime.now().isoformat(),
                    },
                )
            )

    return tasks


@session_router.post("/logout", summary="Deletes the Session", operation_id="logout")
def logout(request: Request, response: Response):
    session_id = request.headers.get(config.SESSION_ID_HEADER)

    response = JSONResponse({"message": "Logged out"}, status_code=200)
    if session_id is not None and session_id in Session.sessions:
        Session.sessions.pop(session_id)

    return response
