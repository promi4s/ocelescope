from fastapi.exceptions import HTTPException
from ocelescope_backend.app.internal.tasks.base import TaskState

from ocelescope_module_plugin.models.plugin_result import PluginOutput
from ocelescope_module_plugin.tasks import PluginTask


def select_outputs(plugin_task: PluginTask, ids: list[str]) -> list[PluginOutput]:
    """Resolve the requested output ids, rejecting any the task did not produce."""
    if plugin_task.state != TaskState.SUCCESS:
        raise HTTPException(status_code=409, detail="Task has no results yet")

    outputs = {output.id: output for output in PluginOutput.from_task(plugin_task)}

    selected: list[PluginOutput] = []
    for id in ids:
        if id not in outputs:
            raise HTTPException(status_code=404, detail=f"Output {id} does not exist")
        selected.append(outputs[id])

    return selected
