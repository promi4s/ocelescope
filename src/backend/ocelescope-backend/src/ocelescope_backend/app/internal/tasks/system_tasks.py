import json
import shutil
import tempfile
import traceback
import zipfile
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException
from typing_extensions import TypedDict

from ocelescope import OCEL
from ocelescope_backend.app.internal.config import config
from ocelescope_backend.app.internal.model.resource import ResourceStore
from ocelescope_backend.app.internal.registry import registry_manager
from ocelescope_backend.app.internal.session import Session
from ocelescope_backend.app.internal.tasks.system import system_task
from ocelescope_backend.app.sse_manager import (
    ErrorNotification,
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
    file_path: Path,
    metadata: ImportMetadata,
):
    original_name = Path(metadata["fileName"])

    match original_name.suffix:
        case ".xml":
            desired_suffix = ".xmlocel"
        case ".json":
            desired_suffix = ".jsonocel"
        case _:
            desired_suffix = original_name.suffix

    name = original_name.stem
    read_path = file_path
    try:
        if file_path.suffix != desired_suffix:
            read_path = file_path.with_suffix(desired_suffix)
            file_path.rename(read_path)

        ocel_id = session.add_ocel_from_file(
            read_path,
            name=name,
            created_at=datetime.now().isoformat(),
        )
    finally:
        read_path.unlink(missing_ok=True)
        file_path.unlink(missing_ok=True)

    return [
        SystemNotification(
            title="OCEL successfully uploaded",
            message=f"{name} was uploaded successfully",
            notification_type="info",
            link=OcelLink(ocel_id=ocel_id),
        ),
        InvalidationRequest(routes=["ocels", "tasks"]),
    ]


@system_task(name="importXES")
def import_xes_task(
    session: Session,
    file_path: Path,
    metadata: ImportMetadata,
):
    original_name = Path(metadata["fileName"])

    try:
        ocel = OCEL.read_xes(
            file_path,
        )
    finally:
        file_path.unlink(missing_ok=True)

    ocel.meta.extra = {
        "name": original_name.stem,
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
    file_path: Path,
    metadata: ImportMetadata,
):
    added_plugin_ids = []

    try:
        if not config.PLUGIN_DIR:
            return []

        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                with zipfile.ZipFile(file_path, "r") as zip_ref:
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
    finally:
        file_path.unlink(missing_ok=True)

    try:
        loaded_plugins = registry_manager.load_plugins(
            added_plugin_ids, ignore_errors=False
        )
    except Exception as e:
        return [
            ErrorNotification(
                type="error",
                title=f"Error while uploading plugin {metadata['fileName']}",
                message=str(e),
                trace=traceback.format_exc(),
            )
        ]

    loaded_plugins = [
        plugin.label
        for id in loaded_plugins
        if (plugin := registry_manager.get_plugin(id)) is not None
    ]

    if len(loaded_plugins) == 0:
        return [
            SystemNotification(
                type="notification",
                title="Uploaded zip didn't contain any plugins",
                notification_type="error",
                message=f"The uploaded file {metadata['fileName']} did not contain any valid plugins",
            )
        ]

    return [
        SystemNotification(
            title="Plugin successfully uploaded",
            message=f"Successfully uploaded {' '.join(loaded_plugins)}",
            notification_type="info",
        ),
        InvalidationRequest(routes=["plugins", "tasks", "discoveryMethods"]),
    ]


@system_task(name="importResource")
def import_resource(
    session: Session,
    file_path: Path,
    metadata: ImportMetadata,
):
    try:
        data = json.loads(file_path.read_text())
        resource = ResourceStore(**data)

    except Exception:
        return []
    finally:
        file_path.unlink(missing_ok=True)

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
