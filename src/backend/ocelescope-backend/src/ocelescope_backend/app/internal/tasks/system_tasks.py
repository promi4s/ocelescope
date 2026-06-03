import json
import shutil
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import IO
from uuid import uuid4

from fastapi import HTTPException
from typing_extensions import TypedDict

from ocelescope import OCEL
from ocelescope_backend.app.internal.config import config
from ocelescope_backend.app.internal.model.resource import ResourceStore
from ocelescope_backend.app.internal.registry import registry_manager
from ocelescope_backend.app.internal.session import Session
from ocelescope_backend.app.internal.tasks.system import system_task
from ocelescope_backend.app.internal.util.stream_to_tempfile import stream_to_tempfile
from ocelescope_backend.app.sse_manager import (
    InvalidationRequest,
    OcelLink,
    SystemNotification,
)


class ImportMetadata(TypedDict):
    fileName: str
    uploaded_at: str


@system_task(name="importOCEL")
def import_ocel_task(
    session: Session,
    file_stream: IO[bytes],
    metadata: ImportMetadata,
):
    file_path = Path(metadata["fileName"])

    match file_path.suffix:
        case ".xml":
            suffix = ".xmlocel"
        case ".json":
            suffix = ".jsonocel"
        case _:
            suffix = file_path.suffix

    with stream_to_tempfile(file_stream, prefix=file_path.stem, suffix=suffix) as path:
        ocel = OCEL.read(
            path,
            meta={
                "name": file_path.stem,
                "upload_date": datetime.now().isoformat(),
            },
        )
        ocel.extensions.load(registry_manager.get_loaded_extensions())

    ocel_id = session.add_ocel(ocel)

    return [
        SystemNotification(
            title="OCEL successfully uploaded",
            message=f"{ocel.meta.extra.get('name', None) or 'OCEL '} was uploaded successfully",
            notification_type="info",
            link=OcelLink(ocel_id=ocel_id),
        ),
        InvalidationRequest(routes=["ocels", "tasks"]),
    ]


@system_task(name="importXES")
def import_xes_task(
    session: Session,
    file_stream: IO[bytes],
    metadata: ImportMetadata,
):
    file_path = Path(metadata["fileName"])

    with stream_to_tempfile(file_stream, prefix=file_path.stem, suffix=".xes") as path:
        ocel = OCEL.read_xes(
            path,
        )

    ocel.meta.extra = {
        "name": file_path.stem,
        "upload_date": datetime.now().isoformat(),
    }

    ocel_id = session.add_ocel(ocel)

    return [
        SystemNotification(
            title="XES was uploaded successfully",
            message=f"{ocel.meta.extra.get('name', None) or 'OCEL '} was uploaded successfully",
            notification_type="info",
            link=OcelLink(ocel_id=ocel_id),
        ),
        InvalidationRequest(routes=["ocels", "tasks"]),
    ]


@system_task(name="importPlugin")
def import_plugin(
    session: Session,
    file_stream: IO[bytes],
    metadata: ImportMetadata,
):
    added_plugin_ids = []

    if not config.PLUGIN_DIR:
        return []

    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            with zipfile.ZipFile(file_stream, "r") as zip_ref:
                zip_ref.extractall(temp_dir)
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Invalid zip file")

        temp_path = Path(temp_dir)

        for plugin_candidate in temp_path.iterdir():
            if (
                plugin_candidate.is_dir()
                and (plugin_candidate / "__init__.py").exists()
            ):
                plugin_id = f"plugin_{str(uuid4())}"
                shutil.move(plugin_candidate, config.PLUGIN_DIR / plugin_id)
                added_plugin_ids.append(plugin_id)

    registry_manager.load_plugins(added_plugin_ids)

    return [
        SystemNotification(
            title="Plugin successfully uploaded",
            message="",
            notification_type="info",
        ),
        InvalidationRequest(routes=["plugins", "tasks"]),
    ]


@system_task(name="importResource")
def import_resource(
    session: Session,
    file_stream: IO[bytes],
    metadata: ImportMetadata,
):
    try:
        contents = file_stream.read()
        data = json.loads(contents)
        resource = ResourceStore(**data)

    except Exception:
        return []

    session.add_resource(
        resource,
    )

    return [
        SystemNotification(
            title="Resource successfully uploaded",
            message=f"{resource.name} uploaded successfully",
            notification_type="info",
        ),
        InvalidationRequest(routes=["resources", "tasks"]),
    ]
