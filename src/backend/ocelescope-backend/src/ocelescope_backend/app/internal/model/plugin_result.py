from typing import Self, cast

from pydantic import BaseModel

from ocelescope import OCEL, Visualization
from ocelescope_backend.app.internal.tasks.plugin import PluginTask
from ocelescope_backend.app.internal.util.ocel_visualization import visualize_ocel
from ocelescope_backend.app.internal.util.plugin_result import default_result_name


class PluginOutput(BaseModel):
    result_index: int
    default_name: str
    type_label: str
    visualization: Visualization | None

    @classmethod
    def from_plugin_result(cls, task: PluginTask) -> list[Self]:
        plugin_id, method_name = task.plugin_id, task.method_name

        return [
            cls(
                result_index=index,
                default_name=default_result_name(plugin_id, method_name, index),
                type_label="OCEL",
                visualization=visualize_ocel(result),
            )
            if isinstance(result, OCEL)
            else cls(
                result_index=index,
                default_name=default_result_name(plugin_id, method_name, index),
                type_label=result.label or result.get_label(),
                visualization=cast(Visualization, result.visualize()),
            )
            for index, result in enumerate(task.result or [])
        ]


class ResultSelection(BaseModel):
    index: int
    name: str | None
