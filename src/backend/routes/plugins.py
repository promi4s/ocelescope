import importlib.util
from pathlib import Path
import shutil
from typing import Annotated, Any, Optional
from fastapi.datastructures import UploadFile
from fastapi.exceptions import HTTPException
from fastapi.params import File
from fastapi.routing import APIRouter
from api.dependencies import ApiSession
from api.exceptions import NotFound
from plugins import plugin_registry
from plugins.base import PluginDescription
from uuid import uuid4
from api.config import config
import tempfile
import zipfile
import sys

plugin_router = APIRouter(prefix="/plugins", tags=["plugins"])


@plugin_router.get("/", operation_id="plugins")
def list_plugins() -> list[PluginDescription]:
    return [plugin.describe() for plugin in plugin_registry.all_plugins().values()]


@plugin_router.post("/run/{name}/{version}/{method}", operation_id="runPlugin")
def run_plugin(
    name: str,
    version: str,
    method: str,
    input_ocels: dict[str, str],
    session: ApiSession,
    input: Optional[dict[str, Any]] = None,
) -> str:
    # TODO: Make better task plugin interactions
    method_map = plugin_registry.get_plugin(name=name, version=version).get_method_map(
        f"{name}_{version}"
    )
    runner = method_map[method]
    if runner is None:
        raise NotFound("Plugin mehtod could not be found")

    input_arg = (
        runner["input_model"](**input)
        if runner["input_model"] is not None and input is not None
        else None
    )

    ocel_kwargs = {a: session.get_ocel(b) for a, b in input_ocels.items()}
    method_kwargs = {
        **ocel_kwargs,
        "session": session,
        "metadata": {
            "type": "plugin",
            "name": name,
            "version": version,
            "method": method,
        },
    }
    if input is not None:
        setattr(method_kwargs, "input", input_arg)

    result = runner["method"](**method_kwargs)

    return result


@plugin_router.post("/", operation_id="uploadPlugin")
def upload_plugin(
    file: Annotated[
        UploadFile,
        File(description="An OCEL 2.0 event log (.zip format)"),
    ],
):
    file_name = file.filename
    if not file_name or not file_name.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only zip files are supported")

    module_id = uuid4().hex
    plugin_dir = config.PLUGIN_DIR / module_id
    plugin_dir.mkdir(parents=True, exist_ok=False)

    try:
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = Path(tmp.name)
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"File save failed: {err}")
    finally:
        file.file.close()

    print(tmp_path)

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
            module_name = f"plugin_{module_id}"
            spec = importlib.util.spec_from_file_location(
                module_name, plugin_module_path
            )
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                sys.modules[module_name] = module
                spec.loader.exec_module(module)
                return {"status": "success", "module": module_name}

    shutil.rmtree(plugin_dir, ignore_errors=True)
    raise HTTPException(status_code=500, detail="Error loading plugin")
