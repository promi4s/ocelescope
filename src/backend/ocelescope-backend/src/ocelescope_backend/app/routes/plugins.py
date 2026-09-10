import json
import shutil
import zipfile
from datetime import datetime
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from fastapi import Body
from fastapi.exceptions import HTTPException
from fastapi.routing import APIRouter
from pydantic import BaseModel

from ocelescope import OCEL
from ocelescope_backend.app.dependencies import ApiPluginTask, ApiSession
from ocelescope_backend.app.internal.config import config
from ocelescope_backend.app.internal.exceptions import NotFound
from ocelescope_backend.app.internal.model.plugin import MethodApi, PluginApi
from ocelescope_backend.app.internal.model.plugin_result import (
    PluginOutput,
    ResultSelection,
)
from ocelescope_backend.app.internal.model.resource import ResourceStore
from ocelescope_backend.app.internal.model.response import TempFileResponse
from ocelescope_backend.app.internal.registry import registry_manager
from ocelescope_backend.app.internal.registry.resource import RegistryError
from ocelescope_backend.app.internal.tasks.base import call_with_known_params
from ocelescope_backend.app.internal.tasks.plugin import PluginTask
from ocelescope_backend.app.internal.util.plugin_result import (
    default_result_name,
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

    if not plugin:
        raise NotFound(f"No plugin found for {plugin_id!r}")

    return PluginApi.from_plugin(plugin_id, plugin)


@plugin_router.get("/{plugin_id}/{method_name}", operation_id="getPluginMethod")
def get_plugin_method(plugin_id: str, method_name: str) -> MethodApi | None:
    try:
        return MethodApi.from_method_meta(
            registry_manager.get_plugin_method(plugin_id, method_name)
        )
    except Exception:
        pass


@plugin_router.post("/{plugin_id}/{method_name}", operation_id="runPlugin")
def run_plugin(
    input_resources: dict[str, str | None],
    session: ApiSession,
    plugin_id: str,
    method_name: str,
    input: dict[str, Any] = {},
) -> str:
    try:
        return PluginTask.create_plugin_task(
            session,
            plugin_id=plugin_id,
            method_name=method_name,
            input={"input": input, "input_resources": input_resources},
        )
    except RegistryError as error:
        raise NotFound(str(error))


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
    selection: list[ResultSelection],
) -> SavedResults:
    """Save the selected results into the session as OCELs / resources."""
    selected = select_results(plugin_task, [result.index for result in selection])

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
                    ResourceStore.from_resource(
                        name=name, source_id=plugin_id, resource=entity
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
    indices: list[int] = Body(embed=True),
) -> TempFileResponse:
    """Bundle the selected results into a zip for download."""
    selected = select_results(plugin_task, indices)

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
                resource_with_meta = ResourceStore.from_resource(
                    resource=entity, name=name, source_id=plugin_id
                ).export()

                archive.writestr(
                    _unique(name, ".ocelescope"),
                    json.dumps(resource_with_meta, indent=2),
                )

    return file_response


@plugin_router.post(
    "/{plugin_id}/{method_name}/computed/{provider}", operation_id="getComputedValues"
)
def get_computed(
    input_resources: dict[str, str | None],
    configuration_input: dict[str, Any],
    session: ApiSession,
    plugin_id: str,
    provider: str,
    method_name: str,
) -> list[str]:
    try:
        method = registry_manager.get_plugin_method(plugin_id, method_name)
    except RegistryError as error:
        raise NotFound(str(error))

    input_class = method.configuration_input
    fn = getattr(input_class, provider, None)
    if fn is None:
        raise NotFound(f"{method_name}.{provider} not found")

    try:
        with registry_manager.get_computed_kwargs(
            session=session,
            plugin_id=plugin_id,
            method_name=method_name,
            input_resources=input_resources,
        ) as kwargs:
            kwargs["input"] = configuration_input

            return call_with_known_params(fn, **kwargs)
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
