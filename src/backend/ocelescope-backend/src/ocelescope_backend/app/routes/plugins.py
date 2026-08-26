import json
import shutil
import zipfile
from contextlib import ExitStack
from datetime import datetime
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from fastapi import Body
from fastapi.exceptions import HTTPException
from fastapi.routing import APIRouter
from pydantic import BaseModel

from ocelescope import OCEL, PluginMethod, Resource
from ocelescope_backend.app.dependencies import ApiPluginTask, ApiSession
from ocelescope_backend.app.internal.config import config
from ocelescope_backend.app.internal.model.plugin import (
    PluginApi,
    PluginOutput,
    ResultSelection,
)
from ocelescope_backend.app.internal.model.resource import ResourceStore
from ocelescope_backend.app.internal.model.response import TempFileResponse
from ocelescope_backend.app.internal.registry import registry_manager
from ocelescope_backend.app.internal.tasks.base import _call_with_known_params
from ocelescope_backend.app.internal.tasks.plugin import PluginTask
from ocelescope_backend.app.internal.util.plugin_result import (
    default_result_name,
    plugin_source,
    select_results,
)
from ocelescope_backend.app.sse_manager import (
    InvalidationRequest,
    sse_manager,
)

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
    input_ocels: dict[str, str | None],
    input_resources: dict[str, str | None],
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


@plugin_router.get(
    "/{plugin_id}/{method_name}/result/{task_id}", operation_id="PluginResult"
)
def get_plugin_result(
    plugin_task: ApiPluginTask,
) -> list[PluginOutput] | None:
    if plugin_task.result is None:
        return None

    return PluginOutput.from_plugin_result(plugin_task)


class SavedResults(BaseModel):
    ocel_ids: list[str]
    resource_ids: list[str]


@plugin_router.post(
    "/{plugin_id}/{method_name}/result/{task_id}/save",
    operation_id="savePluginResults",
)
def save_plugin_results(
    session: ApiSession,
    plugin_task: ApiPluginTask,
    plugin_id: str,
    method_name: str,
    task_id: str,
    selection: list[ResultSelection],
) -> SavedResults:
    """Save the selected results into the session as OCELs / resources."""
    selected = select_results(plugin_task, [result.index for result in selection])

    source = plugin_source(plugin_id, method_name, task_id)

    saved = SavedResults(ocel_ids=[], resource_ids=[])

    for index, entity in selected:
        name = next(result.name for result in selection) or default_result_name(
            plugin_id=plugin_id, method_name=method_name, index=index
        )

        if isinstance(entity, OCEL):
            saved.ocel_ids.append(session.add_ocel(entity, name))
        else:
            saved.resource_ids.append(
                session.add_resource(
                    ResourceStore(
                        name=name,
                        type=entity.get_type(),
                        source=source,
                        data=entity.model_dump(mode="json"),
                    )
                )
            )

    return saved


@plugin_router.post(
    "/{plugin_id}/{method_name}/result/{task_id}/download",
    operation_id="downloadPluginResults",
)
def download_plugin_results(
    plugin_task: ApiPluginTask,
    plugin_id: str,
    method_name: str,
    task_id: str,
    indices: list[int] = Body(embed=True),
) -> TempFileResponse:
    """Bundle the selected results into a zip for download."""
    selected = select_results(plugin_task, indices)
    source = plugin_source(plugin_id, method_name, task_id)

    archive_name = f"{plugin_id}_{method_name}_results"
    file_response = TempFileResponse(
        prefix=datetime.now().strftime("%Y%m%d-%H%M%S") + "-",
        suffix=".zip",
        filename=f"{archive_name}.zip",
    )

    used_names: set[str] = set()

    def _unique(name: str, extension: str) -> str:
        filename = f"{name}{extension}"
        suffix = 1
        while filename in used_names:
            filename = f"{name}_{suffix}{extension}"
            suffix += 1
        used_names.add(filename)
        return filename

    with zipfile.ZipFile(file_response.tmp_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for index, entity in selected:
            name = default_result_name(plugin_id, method_name, index)

            if isinstance(entity, OCEL):
                with NamedTemporaryFile(suffix=".json") as ocel_file:
                    entity.write(Path(ocel_file.name))
                    archive.write(ocel_file.name, arcname=_unique(name, ".json"))
            else:
                store = ResourceStore(
                    name=name,
                    type=entity.get_type(),
                    source=source,
                    data=entity.model_dump(mode="json"),
                )
                archive.writestr(
                    _unique(name, ".ocelescope"),
                    json.dumps(store.model_dump(mode="json"), indent=2),
                )

    return file_response


@plugin_router.post(
    "/{plugin_id}/{method_name}/computed/{provider}", operation_id="getComputedValues"
)
def get_computed(
    input_ocels: dict[str, str | None],
    input_resources: dict[str, str | None],
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

    with ExitStack() as ocels:
        ocel_args: dict[str, OCEL] = {
            key: ocels.enter_context(session.get_ocel(ocel_id))
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


@plugin_router.delete("/{plugin_id}", operation_id="deletePlugin")
def delete_plugin(plugin_id: str, session: ApiSession):
    if not config.PLUGIN_DIR:
        raise HTTPException(status_code=404, detail="Plugin files not found")

    plugin_path = config.PLUGIN_DIR / plugin_id

    if not plugin_path.exists():
        raise HTTPException(status_code=404, detail="Plugin files not found")

    registry_manager.unload_plugins([plugin_id])

    shutil.rmtree(plugin_path, ignore_errors=True)

    sse_manager.send_safe(
        session.id,
        InvalidationRequest(
            routes=["plugins", "discoveryMethods"],
        ),
    )

    return {"status": "deleted", "module": plugin_id}
