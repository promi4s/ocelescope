import importlib.util
from pathlib import Path
import shutil
from typing import Any, Optional
from fastapi.datastructures import UploadFile
from fastapi.exceptions import HTTPException
from fastapi.routing import APIRouter
from uuid import uuid4

from api.websocket import websocket_manager, InvalidationRequest
from ocelescope.ocel.ocel import OCEL

from api.config import config
import tempfile
import zipfile
import sys
from api.dependencies import ApiSession

from api.model.plugin import PluginApi

# TODO: Put this in own util function
from tasks.base import _call_with_known_params
from api.model.resource import Resource
from registry import plugin_registry
from registry import extension_registry
from tasks.plugin import PluginTask

plugin_router = APIRouter(prefix="/plugins", tags=["plugins"])


@plugin_router.get("/", operation_id="plugins")
def get_plugins() -> list[PluginApi]:
    return plugin_registry.list_plugins()


@plugin_router.post("/{plugin_name}/{method_name}", operation_id="runPlugin")
def run_plugin(
    input_ocels: dict[str, str],
    input_resources: dict[str, str],
    session: ApiSession,
    plugin_name: str,
    method_name: str,
    input: dict[str, Any] = {},
) -> str:
    return PluginTask.create_plugin_task(
        session,
        plugin_name=plugin_name,
        method_name=method_name,
        input={"input": input, "ocels": input_ocels, "resources": input_resources},
    )


@plugin_router.post(
    "/{plugin_name}/{method_name}/computed/{provider}", operation_id="getComputedValues"
)
def get_computed(
    input_ocels: dict[str, Optional[str]],
    input_resources: dict[str, Optional[str]],
    input: dict[str, Any],
    session: ApiSession,
    plugin_name: str,
    provider: str,
    method_name: str,
) -> list[str]:
    method = plugin_registry.get_method(plugin_name, method_name)
    input_class = method._input_model
    fn = getattr(input_class, provider, None)
    if fn is None:
        raise KeyError(f"{method_name}.{provider} not found")

    ocel_args: dict[str, OCEL] = {
        key: session.get_ocel(ocel_id)
        for key, ocel_id in input_ocels.items()
        if ocel_id is not None
    }
    resource_args: dict[str, Resource] = {
        key: session.get_resource(resource_id)
        for key, resource_id in input_resources.items()
        if resource_id is not None
    }

    kwargs = {**ocel_args, **resource_args, "input": input}

    try:
        return _call_with_known_params(fn, **kwargs)
    except Exception:
        return []


@plugin_router.post("/", operation_id="uploadPlugin")
def upload_plugin(file: UploadFile, session: ApiSession):
    file_name = file.filename
    if not file_name or not file_name.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only zip files are supported")

    module_name = uuid4().hex
    plugin_dir = config.PLUGIN_DIR / module_name
    plugin_dir.mkdir(parents=True, exist_ok=False)

    try:
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = Path(tmp.name)
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"File save failed: {err}")
    finally:
        file.file.close()

    try:
        with zipfile.ZipFile(tmp_path, "r") as zip_ref:
            zip_ref.extractall(plugin_dir)
    except zipfile.BadZipFile:
        tmp_path.unlink(missing_ok=True)
        shutil.rmtree(plugin_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail="Invalid zip file")

    tmp_path.unlink(missing_ok=True)

    for item in plugin_dir.iterdir():
        if item.is_dir() and (item / "__init__.py").exists():
            plugin_module_path = item / "__init__.py"
            spec = importlib.util.spec_from_file_location(
                module_name, plugin_module_path
            )
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                sys.modules[module_name] = module
                spec.loader.exec_module(module)
                plugin_registry.register(module)
                extension_registry.register(module)
                websocket_manager.send_safe(
                    session_id=session.id,
                    message=InvalidationRequest(routes=["plugins"]),
                )
                return {"status": "success", "module": module_name}

    websocket_manager.send_safe(
        session_id=session.id, message=InvalidationRequest(routes=["plugins"])
    )
    shutil.rmtree(plugin_dir, ignore_errors=True)
    raise HTTPException(status_code=500, detail="Error loading plugin")


@plugin_router.delete("/{module_id}", operation_id="deletePlugin")
def delete_plugin(module_id: str, session: ApiSession):
    plugin_path = config.PLUGIN_DIR / module_id

    if not plugin_path.exists():
        raise HTTPException(status_code=404, detail="Plugin files not found")

    module = sys.modules.get(module_id)
    if module:
        plugin_registry.unload_module(module)
        extension_registry.unload_module(module)

    try:
        shutil.rmtree(plugin_path)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to delete plugin files: {e}"
        )

    websocket_manager.send_safe(
        session.id,
        InvalidationRequest(
            routes=["plugins"],
        ),
    )

    return {"status": "deleted", "module": module_id}
