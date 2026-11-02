import shutil
import zipfile
from datetime import UTC, datetime
from tempfile import NamedTemporaryFile
from typing import Annotated, Any

from fastapi import Body
from fastapi.exceptions import HTTPException
from fastapi.routing import APIRouter
from ocelescope.ocel.io import export_duckdb_ocel
from ocelescope_backend.app.dependencies import ApiOcel, ApiSession
from ocelescope_backend.app.internal.exceptions import NotFound
from ocelescope_backend.app.internal.model.response import TempFileResponse
from ocelescope_backend.app.internal.registry.resource import RegistryError
from ocelescope_backend.app.internal.tasks.base import (
    TaskState,
    call_with_known_params,
)
from ocelescope_backend.app.sse_manager import (
    InvalidationRequest,
    sse_manager,
)
from pydantic import BaseModel

from ocelescope import Plotly
from ocelescope_module_plugin.config import config
from ocelescope_module_plugin.dependencies import ApiPluginRegistry, ApiPluginTask
from ocelescope_module_plugin.models.plugin import MethodApi, PluginApi
from ocelescope_module_plugin.models.plugin_result import (
    PluginOutput,
    ResultSelection,
)
from ocelescope_module_plugin.ocel_visualization import visualize_ocel
from ocelescope_module_plugin.registry import PluginRegistry
from ocelescope_module_plugin.results import select_outputs
from ocelescope_module_plugin.tasks import PluginTask

router = APIRouter(tags=["plugins"])


@router.get("/plugins", operation_id="plugins")
def get_plugins(
    registry: ApiPluginRegistry, include_base: bool = False
) -> list[PluginApi]:
    return [
        plugin
        for plugin in registry.list_plugins()
        if include_base or plugin.id != PluginRegistry.BASE_PLUGIN_ID
    ]


@router.get("/plugin/{plugin_id}", operation_id="getPlugin")
def get_plugin(registry: ApiPluginRegistry, plugin_id: str) -> PluginApi | None:
    plugin = registry.get_plugin(plugin_id)

    if not plugin:
        raise NotFound(f"No plugin found for {plugin_id!r}")

    return PluginApi.from_plugin(plugin_id, plugin)


@router.get("/plugin/{plugin_id}/{method_name}", operation_id="getPluginMethod")
def get_plugin_method(
    registry: ApiPluginRegistry, plugin_id: str, method_name: str
) -> MethodApi | None:
    try:
        return MethodApi.from_method_meta(registry.get_method(plugin_id, method_name))
    except Exception:
        pass


@router.post("/plugin/{plugin_id}/{method_name}", operation_id="runPlugin")
def run_plugin(
    input_resources: dict[str, str | None],
    session: ApiSession,
    registry: ApiPluginRegistry,
    plugin_id: str,
    method_name: str,
    input: dict[str, Any] | None = None,
) -> str:
    try:
        return PluginTask.create_plugin_task(
            session,
            registry,
            plugin_id=plugin_id,
            method_name=method_name,
            input={"input": input or {}, "input_resources": input_resources},
        )
    except RegistryError as error:
        raise NotFound(str(error))


@router.get("/task/{task_id}", operation_id="PluginResult")
def get_plugin_result(
    plugin_task: ApiPluginTask,
) -> list[PluginOutput] | None:
    if plugin_task.state != TaskState.SUCCESS:
        return None

    return PluginOutput.from_task(plugin_task)


@router.get("/ocel/{ocel_id}/visualization", operation_id="ocelVisualization")
def get_ocel_visualization(ocel: ApiOcel) -> Plotly:
    return visualize_ocel(ocel)


class SavedResults(BaseModel):
    ocel_ids: list[str]
    resource_ids: list[str]


@router.post(
    "/task/{task_id}/save",
    operation_id="savePluginResults",
)
def save_plugin_results(
    session: ApiSession,
    plugin_task: ApiPluginTask,
    selection: list[ResultSelection],
) -> SavedResults:
    """Save the selected results into the session as OCELs / resources."""
    selected = select_outputs(plugin_task, [result.id for result in selection])

    saved = SavedResults(ocel_ids=[], resource_ids=[])

    for result, output in zip(selection, selected, strict=True):
        name = result.name or output.name

        if output.type == "ocel":
            saved.ocel_ids.append(
                session.add_ocel(
                    session.get_ocel(output.id).db_path,
                    name,
                    source_id=plugin_task.plugin_id,
                )
            )
        else:
            saved.resource_ids.append(
                session.add_resource(
                    session.get_resource(output.id),
                    name=name,
                    source_id=plugin_task.plugin_id,
                )
            )

    return saved


@router.post(
    "/task/{task_id}/download",
    operation_id="downloadPluginResults",
)
def download_plugin_results(
    plugin_task: ApiPluginTask,
    ids: Annotated[list[str], Body(embed=True)],
) -> TempFileResponse:
    """Bundle the selected results into a zip for download."""
    selected = select_outputs(plugin_task, ids)

    archive_name = f"{plugin_task.plugin_id}_{plugin_task.method_name}_results"
    file_response = TempFileResponse(
        prefix=datetime.now(tz=UTC).strftime("%Y%m%d-%H%M%S") + "-",
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
        for output in selected:
            if output.type == "ocel":
                db_path = plugin_task.session.get_ocel(output.id).db_path
                with NamedTemporaryFile(suffix=".json") as ocel_file:
                    export_duckdb_ocel(db_path, ocel_file.name)
                    archive.write(ocel_file.name, arcname=_unique(output.name, ".json"))
            else:
                with (
                    NamedTemporaryFile(suffix=".ocelescope") as resource_file,
                    plugin_task.session.open_resource(output.id) as resource,
                ):
                    resource.write(resource_file.name)
                    archive.write(
                        resource_file.name,
                        arcname=_unique(output.name, ".ocelescope"),
                    )

    return file_response


@router.post(
    "/plugin/{plugin_id}/{method_name}/computed/{provider}",
    operation_id="getComputedValues",
)
def get_computed(
    input_resources: dict[str, str | None],
    configuration_input: dict[str, Any],
    session: ApiSession,
    registry: ApiPluginRegistry,
    plugin_id: str,
    provider: str,
    method_name: str,
) -> list[str]:
    try:
        method = registry.get_method(plugin_id, method_name)
    except RegistryError as error:
        raise NotFound(str(error))

    input_class = method.configuration_input
    fn = getattr(input_class, provider, None)
    if fn is None:
        raise NotFound(f"{method_name}.{provider} not found")

    try:
        with registry.computed_kwargs(
            session=session,
            plugin_id=plugin_id,
            method_name=method_name,
            input_resources=input_resources,
        ) as kwargs:
            kwargs["input"] = configuration_input

            return call_with_known_params(fn, **kwargs)
    except Exception:
        return []


@router.delete("/plugin/{plugin_id}", operation_id="deletePlugin")
def delete_plugin(registry: ApiPluginRegistry, plugin_id: str, session: ApiSession):
    if not config.PLUGIN_DIR:
        raise HTTPException(status_code=404, detail="Plugin files not found")

    plugin_path = config.PLUGIN_DIR / plugin_id

    if not plugin_path.exists():
        raise HTTPException(status_code=404, detail="Plugin files not found")

    registry.unload_module(plugin_id)

    shutil.rmtree(plugin_path, ignore_errors=True)

    sse_manager.send_safe(
        session.id,
        InvalidationRequest(
            routes=["plugins", "discoveryMethods"],
        ),
    )

    return {"status": "deleted", "module": plugin_id}
