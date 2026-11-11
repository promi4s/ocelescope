from __future__ import annotations

from pydantic import BaseModel

from ocelescope_backend.app.internal.tasks.store import TaskRecord, TaskState


class SystemTaskApi(BaseModel):
    id: str
    name: str
    file_name: str
    state: TaskState
    created_at: str
    started_at: str | None
    finished_at: str | None

    @classmethod
    def from_record(cls, record: TaskRecord) -> SystemTaskApi:
        return cls(
            id=record.id,
            name=record.name,
            file_name=record.arguments["file_name"],
            state=record.state,
            created_at=record.created_at,
            started_at=record.started_at,
            finished_at=record.finished_at,
        )
