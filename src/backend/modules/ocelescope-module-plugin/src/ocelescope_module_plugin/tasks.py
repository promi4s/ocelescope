from __future__ import annotations

import inspect
from collections.abc import Callable
from copy import deepcopy
from typing import Any, TypeVar

from ocelescope_backend.app.internal.tasks.decorator import task
from ocelescope_backend.app.internal.tasks.outputs import Output, TaskResult

from ocelescope import OCEL, Plugin, ResourceBase
from ocelescope_module_plugin.base_plugin import BasePlugin
from ocelescope_module_plugin.config import config
from ocelescope_module_plugin.plugin_inputs import ResourceArg, match_resource_class
from ocelescope_module_plugin.registry import (
    MethodNotFound,
    PluginNotFound,
    PluginRegistry,
    find_plugin_class,
    import_plugin_module,
)

PLUGIN_TASK_NAME = "runPlugin"

T = TypeVar("T")


def call_with_known_params(fn: Callable[..., T], *args: Any, **kwargs: Any) -> T:
    allowed = inspect.signature(fn).parameters.keys()
    return fn(*args, **{key: value for key, value in kwargs.items() if key in allowed})


def load_plugin(plugin_id: str) -> Plugin:
    if plugin_id == PluginRegistry.BASE_PLUGIN_ID:
        return BasePlugin()
    if config.PLUGIN_DIR is None:
        raise PluginNotFound(plugin_id)
    return find_plugin_class(import_plugin_module(config.PLUGIN_DIR, plugin_id))()


def _flatten(result: Any) -> list[OCEL | ResourceBase]:
    entities: list[OCEL | ResourceBase] = []
    for item in result if isinstance(result, tuple) else (result,):
        if isinstance(item, list):
            entities.extend(item)
        elif item is not None:
            entities.append(item)
    return entities


@task(name=PLUGIN_TASK_NAME, hidden=True, dedupe=True)
def run_plugin_method(
    plugin_id: str,
    method_name: str,
    inputs: dict[str, OCEL | ResourceArg | None],
    configuration: dict[str, Any],
) -> TaskResult:
    plugin = load_plugin(plugin_id)
    method = plugin.method_map().get(method_name)
    if method is None:
        raise MethodNotFound(plugin_id, method_name)

    resource_types = {
        resource_type.get_schema_hash(): resource_type
        for resource_type in plugin.get_resources()
    }

    kwargs: dict[str, Any] = {}
    for io in method.inputs:
        value = inputs.get(io.name)
        if isinstance(value, ResourceArg):
            resource_class = match_resource_class(io, value.schema_hash)
            if resource_class is None:
                raise TypeError(f"Input {io.name!r} has an unexpected resource type")
            value = resource_class.load(value.path, resolve=resource_types.__getitem__)
        elif isinstance(value, OCEL):
            value = deepcopy(value)
        kwargs[io.name] = value

    if method.configuration_input is not None:
        kwargs["input"] = method.configuration_input(**configuration)

    result = call_with_known_params(method.bind(plugin), **kwargs)

    return [
        Output(entity, name=f"{plugin.get_name()}_{method_name}_{index}")
        for index, entity in enumerate(_flatten(result))
    ]
