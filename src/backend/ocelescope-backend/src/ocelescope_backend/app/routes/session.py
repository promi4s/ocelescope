from __future__ import annotations

import traceback
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

from fastapi import File, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse, Response
from fastapi.routing import APIRouter

from ocelescope_backend.app.dependencies import ApiSession
from ocelescope_backend.app.internal.config import config
from ocelescope_backend.app.internal.registry import upload_claimers
from ocelescope_backend.app.internal.session import Session
from ocelescope_backend.app.internal.tasks.system_tasks import (
    import_archive,
    import_ocel_task,
    import_resource,
    import_xes_task,
)
from ocelescope_backend.app.internal.util.spool_upload import spool_upload_to_tempfile
from ocelescope_backend.app.sse_manager import (
    ErrorNotification,
    SSEMessage,
    SystemNotification,
    sse_manager,
)

session_router = APIRouter(prefix="/session", tags=["session"])


def _claim_upload(file_path: Path, file_name: str) -> list[SSEMessage] | None:
    for claim in upload_claimers:
        try:
            if (messages := claim(file_path, file_name)) is not None:
                return messages
        except Exception as exc:
            return [
                ErrorNotification(
                    type="error",
                    title=f"Could not import {file_name}",
                    message=str(exc),
                    trace=traceback.format_exc(),
                )
            ]
    return None


@session_router.post(
    "/upload", summary="Upload logs, plugins, or resources", operation_id="upload"
)
async def upload(
    session: ApiSession, files: Annotated[list[UploadFile], File()]
) -> list[str]:
    tasks = []
    for file in files:
        if file.filename is None:
            continue

        file_path = Path(file.filename)
        tmp_path = await spool_upload_to_tempfile(file, suffix=file_path.suffix)

        claimed = await run_in_threadpool(_claim_upload, tmp_path, file_path.name)
        if claimed is not None:
            tmp_path.unlink(missing_ok=True)
            for message in claimed:
                await sse_manager.send(session_id=session.id, message=message)
            continue

        task_method = None
        match file_path.suffix.lower():
            case ".zip" if [suffix.lower() for suffix in file_path.suffixes[-2:]] != [
                ".ocel",
                ".zip",
            ]:
                task_method = import_archive
            case ".ocelescope":
                task_method = import_resource
            case (
                ".xml"
                | ".xmlocel"
                | ".json"
                | ".jsonocel"
                | ".sqlite"
                | ".csv"
                | ".zip"
            ):
                task_method = import_ocel_task
            case ".xes":
                task_method = import_xes_task
            case ".gz" if [suffix.lower() for suffix in file_path.suffixes[-2:]] == [
                ".xes",
                ".gz",
            ]:
                task_method = import_xes_task

        if task_method is None:
            tmp_path.unlink(missing_ok=True)
            await sse_manager.send(
                session_id=session.id,
                message=SystemNotification(
                    title="Unsupported File format",
                    notification_type="error",
                    message=f"The file format {file_path.suffix} is currently not supported",
                ),
            )

            continue

        tasks.append(
            task_method(
                session=session,
                file_path=tmp_path,
                metadata={
                    "fileName": file_path.name,
                    "uploaded_at": datetime.now(UTC).isoformat(),
                },
            )
        )

    return tasks


@session_router.post("/logout", summary="Deletes the Session", operation_id="logout")
def logout(request: Request, response: Response):
    session_id = request.headers.get(config.SESSION_ID_HEADER)

    response = JSONResponse({"message": "Logged out"}, status_code=200)
    if session_id is not None and (session := Session.get(session_id)) is not None:
        session.close()

    return response
