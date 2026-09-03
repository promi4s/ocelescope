from fastapi.exceptions import HTTPException

from ocelescope import OCEL, Resource
from ocelescope_backend.app.internal.registry import registry_manager
from ocelescope_backend.app.internal.tasks.plugin import PluginTask


def select_results(
    plugin_task: PluginTask, indices: list[int]
) -> list[tuple[int, OCEL | Resource]]:
    """Resolve the requested result indices, validating each one."""
    if plugin_task.result is None:
        raise HTTPException(status_code=409, detail="Task has no results yet")

    selected: list[tuple[int, OCEL | Resource]] = []
    for index in indices:
        if index < 0 or index >= len(plugin_task.result):
            raise HTTPException(
                status_code=404, detail=f"Result index {index} does not exist"
            )
        selected.append((index, plugin_task.result[index]))

    return selected


def _safe_get_plugin(plugin_id: str):
    """`registry_manager.get_plugin` raises if the plugin is no longer loaded."""
    try:
        return registry_manager.get_plugin(plugin_id)
    except KeyError:
        return None


def default_result_name(plugin_id: str, method_name: str, index: int) -> str:
    plugin = _safe_get_plugin(plugin_id)
    base = plugin.meta().name if plugin else plugin_id
    return f"{base}_{method_name}_{index}"
