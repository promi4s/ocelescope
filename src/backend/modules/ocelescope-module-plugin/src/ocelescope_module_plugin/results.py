from pathlib import Path

from fastapi.exceptions import HTTPException
from ocelescope_backend.app.internal.model.resource import ResourceStore

from ocelescope_module_plugin.registry import PluginRegistry
from ocelescope_module_plugin.tasks import PluginTask


def select_results(
    plugin_task: PluginTask, indices: list[int]
) -> list[tuple[int, Path | ResourceStore]]:
    """Resolve the requested result indices, validating each one."""
    if plugin_task.result is None:
        raise HTTPException(status_code=409, detail="Task has no results yet")

    selected: list[tuple[int, Path | ResourceStore]] = []
    for index in indices:
        if index < 0 or index >= len(plugin_task.result):
            raise HTTPException(
                status_code=404, detail=f"Result index {index} does not exist"
            )
        selected.append((index, plugin_task.result[index]))

    return selected


def default_result_name(
    registry: PluginRegistry, plugin_id: str, method_name: str, index: int
) -> str:
    plugin = registry.get_plugin(plugin_id)
    base = plugin.get_name() if plugin else plugin_id
    return f"{base}_{method_name}_{index}"
