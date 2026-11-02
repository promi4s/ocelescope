from typing import Literal, Self

from pydantic import BaseModel

from ocelescope_module_plugin.tasks import PluginTask


class PluginOutput(BaseModel):
    id: str
    type: Literal["ocel", "resource"]
    name: str
    type_label: str
    created_at: str

    @classmethod
    def from_task(cls, task: PluginTask) -> list[Self]:
        session = task.session

        ocels = [
            cls(
                id=ocel.id,
                type="ocel",
                name=ocel.name,
                type_label="OCEL",
                created_at=ocel.created_at,
            )
            for ocel in session.list_ocels(source_id=task.id, include_hidden=True)
        ]
        resources = [
            cls(
                id=resource.id,
                type="resource",
                name=resource.name,
                type_label=resource.resource_type_label,
                created_at=resource.created_at,
            )
            for resource in session.list_resources(
                source_id=task.id, include_hidden=True
            )
        ]

        return sorted([*ocels, *resources], key=lambda output: output.created_at)


class ResultSelection(BaseModel):
    id: str
    name: str | None
