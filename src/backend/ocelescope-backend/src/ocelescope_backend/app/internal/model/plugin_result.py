from pathlib import Path
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
        outputs: list[Self] = []

        for index, result in enumerate(task.result or []):
            default_name = default_result_name(plugin_id, method_name, index)

            if isinstance(result, Path):
                with OCEL.read_duckdb(result, read_only=True) as ocel:
                    outputs.append(
                        cls(
                            result_index=index,
                            default_name=default_name,
                            type_label="OCEL",
                            visualization=visualize_ocel(ocel),
                        )
                    )
                continue

            with task.session.open_store(result) as resource:
                outputs.append(
                    cls(
                        result_index=index,
                        default_name=default_name,
                        type_label=resource.get_label(),
                        visualization=cast(Visualization, resource.visualize()),
                    )
                )

        return outputs


class ResultSelection(BaseModel):
    index: int
    name: str | None
