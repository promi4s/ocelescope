import shutil
from typing import Any, Optional

from fastapi.exceptions import HTTPException
from fastapi.routing import APIRouter
from pydantic_settings import SecretsSettingsSource

from ocelescope import OCEL, PluginMethod, Resource
from ocelescope_backend.app.dependencies import ApiSession
from ocelescope_backend.app.internal.config import config
from ocelescope_backend.app.internal.exceptions import NotFound
from ocelescope_backend.app.internal.model.plugin import (
    OCELOutput,
    PluginApi,
    PluginOutput,
    ResourceOutput,
)

# TODO: Put this in own util function
from ocelescope_backend.app.internal.registry import registry_manager
from ocelescope_backend.app.internal.tasks.base import _call_with_known_params
from ocelescope_backend.app.internal.tasks.plugin import PluginTask
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


@plugin_router.get(
    "/{plugin_id}/{method_name}/result/{task_id}", operation_id="PluginResult"
)
def get_plugin_result(
    session: ApiSession, plugin_id: str, method_name: str, task_id: str
) -> list[PluginOutput] | None:
    plugin_task = session.get_task(task_id)

    if (
        plugin_task is None
        or not isinstance(plugin_task, PluginTask)
        or plugin_task.plugin_id != plugin_id
        or plugin_task.method_name != method_name
    ):
        raise NotFound("Task could not be found")

    if plugin_task.result is None:
        return None

    return [
        OCELOutput.from_ocel(index, result)
        if isinstance(result, OCEL)
        else ResourceOutput.from_resource(index, result)
        for index, result in enumerate(plugin_task.result)
    ]


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
            routes=["plugins"],
        ),
    )

    return {"status": "deleted", "module": plugin_id}
