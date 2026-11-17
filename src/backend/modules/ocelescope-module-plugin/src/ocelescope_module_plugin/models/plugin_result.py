from typing import TYPE_CHECKING, Literal, Self

from ocelescope_backend.app.internal.tasks.store import TaskRecord
from pydantic import BaseModel

if TYPE_CHECKING:
    from ocelescope_backend.app.internal.session import Session


class PluginOutput(BaseModel):
    id: str
    type: Literal["ocel", "resource"]
    name: str
    type_label: str
    created_at: str

    @classmethod
    def from_task(cls, session: "Session", task: TaskRecord) -> list[Self]:
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
