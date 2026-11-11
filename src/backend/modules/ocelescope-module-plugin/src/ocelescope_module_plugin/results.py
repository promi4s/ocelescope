from typing import TYPE_CHECKING

from fastapi.exceptions import HTTPException
from ocelescope_backend.app.internal.tasks.store import TaskRecord, TaskState

from ocelescope_module_plugin.models.plugin_result import PluginOutput

if TYPE_CHECKING:
    from ocelescope_backend.app.internal.session import Session


def select_outputs(
    session: "Session", plugin_task: TaskRecord, ids: list[str]
) -> list[PluginOutput]:
    """Resolve the requested output ids, rejecting any the task did not produce."""
    if plugin_task.state != TaskState.SUCCESS:
        raise HTTPException(status_code=409, detail="Task has no results yet")

    outputs = {
        output.id: output for output in PluginOutput.from_task(session, plugin_task)
    }

    selected: list[PluginOutput] = []
    for id in ids:
        if id not in outputs:
            raise HTTPException(status_code=404, detail=f"Output {id} does not exist")
        selected.append(outputs[id])

    return selected
