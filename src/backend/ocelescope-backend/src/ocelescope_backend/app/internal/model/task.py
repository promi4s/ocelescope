from __future__ import annotations

from pydantic import BaseModel

from ocelescope_backend.app.internal.tasks.store import TaskRecord, TaskState


class TaskApi(BaseModel):
    id: str
    name: str
    label: str | None
    state: TaskState
    created_at: str
    started_at: str | None
    finished_at: str | None

    @classmethod
    def from_record(cls, record: TaskRecord) -> TaskApi:
        return cls(
            id=record.id,
            name=record.name,
            label=record.label,
            state=record.state,
            created_at=record.created_at,
            started_at=record.started_at,
            finished_at=record.finished_at,
        )
