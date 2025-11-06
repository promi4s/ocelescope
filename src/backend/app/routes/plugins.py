import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

from fastapi.datastructures import UploadFile
from fastapi.exceptions import HTTPException
from fastapi.routing import APIRouter
from ocelescope import PluginMethod, Resource
from ocelescope.ocel.ocel import OCEL

from app.dependencies import ApiSession
from app.internal.config import config
from app.internal.model.plugin import PluginApi

# TODO: Put this in own util function
from app.internal.registry import registry_manager
from app.internal.tasks.base import _call_with_known_params
from app.internal.tasks.plugin import PluginTask
from app.sse_manager import InvalidationRequest, sse_manager

plugin_router = APIRouter(prefix="/plugins", tags=["plugins"])


@plugin_router.get("", operation_id="plugins")
def get_plugins() -> list[PluginApi]:
    return registry_manager.list_plugins()


@plugin_router.get("/{plugin_id}", operation_id="getPlugin")
def get_plugin(plugin_id: str) -> PluginApi | None:
    plugin = registry_manager.get_plugin(plugin_id)

    return (
        PluginApi(
            id=plugin_id, meta=plugin.meta(), methods=list(plugin.method_map().values())
        )
        if plugin
        else None
    )


@plugin_router.get("/{plugin_id}/{method_name}", operation_id="getPluginMethod")
def get_plugin_method(plugin_id: str, method_name: str) -> PluginMethod | None:
    try:
        return registry_manager.get_plugin_method(plugin_id, method_name)
    except Exception:
        pass


@plugin_router.post("/{plugin_id}/{method_name}", operation_id="runPlugin")
def run_plugin(
    input_ocels: dict[str, str],
    input_resources: dict[str, str],
    session: ApiSession,
    plugin_id: str,
    method_name: str,
    input: dict[str, Any] = {},
) -> str:
    return PluginTask.create_plugin_task(
        session,
        plugin_id=plugin_id,
        method_name=method_name,
        input={"input": input, "ocels": input_ocels, "resources": input_resources},
    )


@plugin_router.post(
    "/{plugin_id}/{method_name}/computed/{provider}", operation_id="getComputedValues"
)
def get_computed(
    input_ocels: dict[str, Optional[str]],
    input_resources: dict[str, Optional[str]],
    input: dict[str, Any],
    session: ApiSession,
    plugin_id: str,
    provider: str,
    method_name: str,
) -> list[str]:
    method = registry_manager.get_plugin_method(plugin_id, method_name)

    input_class = method._input_model
    fn = getattr(input_class, provider, None)
    if fn is None:
        raise KeyError(f"{method_name}.{provider} not found")

    ocel_args: dict[str, OCEL] = {
        key: session.get_ocel(ocel_id)
        for key, ocel_id in input_ocels.items()
        if ocel_id is not None
    }

    resource_args: dict[str, Resource | None] = {}

    for key, resource_id in input_resources.items():
        if not resource_id:
            continue

        resource = registry_manager.get_resource_instance(
            session.get_resource(resource_id), plugin_id=plugin_id
        )

        resource_args[key] = resource

    kwargs = {**ocel_args, **resource_args, "input": input}

    try:
        return _call_with_known_params(fn, **kwargs)
    except Exception:
        return []


@plugin_router.post("", operation_id="uploadPlugin")
def upload_plugin(file: UploadFile, session: ApiSession):
    file_name = file.filename
    if not file_name or not file_name.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only zip files are supported")

    added_plugin_ids = []

    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            with zipfile.ZipFile(file.file, "r") as zip_ref:
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


@plugin_router.delete("/{plugin_id}", operation_id="deletePlugin")
def delete_plugin(plugin_id: str, session: ApiSession):
    plugin_path = config.PLUGIN_DIR / plugin_id

    if not plugin_path.exists():
        raise HTTPException(status_code=404, detail="Plugin files not found")

    registry_manager.unload_plugins([plugin_id])

    shutil.rmtree(plugin_path, ignore_errors=True)

    sse_manager.send_safe(
        session.id,
        InvalidationRequest(
            routes=["plugins"],
        ),
    )

    return {"status": "deleted", "module": plugin_id}
