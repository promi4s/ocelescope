import importlib.util
from pathlib import Path
import shutil
from typing import Any
from fastapi.datastructures import UploadFile
from fastapi.exceptions import HTTPException
from fastapi.routing import APIRouter
from uuid import uuid4

from api.config import config
import tempfile
import zipfile
import sys
from api.dependencies import ApiSession

from api.model.plugin import PluginApi
from registry import plugin_registy
from tasks.plugin import PluginTask

plugin_router = APIRouter(prefix="/plugins", tags=["plugins"])


@plugin_router.get("/", operation_id="plugins")
def get_plugins() -> list[PluginApi]:
    return plugin_registy.list_plugins()


@plugin_router.post("/{plugin_name}/{method_name}", operation_id="runPlugin")
def run_plugin(
    input_ocels: dict[str, str],
    input_resources: dict[str, str],
    input: dict[str, Any],
    session: ApiSession,
    plugin_name: str,
    method_name: str,
) -> str:
    return PluginTask.create_plugin_task(
        session,
        plugin_name=plugin_name,
        method_name=method_name,
        input={"input": input, "ocels": input_ocels, "resources": input_resources},
    )


@plugin_router.post("/", operation_id="uploadPlugin")
def upload_plugin(
    file: UploadFile,
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
