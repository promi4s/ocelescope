from __future__ import annotations

import threading
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from enum import Enum
from typing import Any


class TaskState(str, Enum):
    PENDING = "PENDING"
    STARTED = "STARTED"
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    SKIPPED = "SKIPPED"
    CANCELLED = "CANCELLED"


def _now() -> str:
    return datetime.now(tz=UTC).isoformat()


@dataclass(frozen=True)
class TaskRecord:
    id: str
    session_id: str
    name: str
    state: TaskState = TaskState.PENDING
    arguments: dict[str, Any] = field(default_factory=dict)
    dedupe_key: str | None = None
    created_at: str = field(default_factory=_now)
    started_at: str | None = None
    finished_at: str | None = None


class TaskStore:
    def __init__(self) -> None:
        self._tasks: dict[str, TaskRecord] = {}
        self._lock = threading.Lock()

    def add(self, record: TaskRecord) -> None:
        with self._lock:
            self._tasks[record.id] = record

    def get(self, task_id: str) -> TaskRecord | None:
        return self._tasks.get(task_id)

    def update(self, task_id: str, **changes: Any) -> TaskRecord | None:
        with self._lock:
            if task_id not in self._tasks:
                return None
            record = replace(self._tasks[task_id], **changes)
            self._tasks[task_id] = record
            return record

    def query(
        self,
        session_id: str,
        names: list[str] | None = None,
        ids: list[str] | None = None,
        states: list[TaskState] | None = None,
    ) -> list[TaskRecord]:
        return [
            record
            for record in list(self._tasks.values())
            if record.session_id == session_id
            and (not names or record.name in names)
            and (not ids or record.id in ids)
            and (not states or record.state in states)
        ]

    def find_duplicate(self, session_id: str, dedupe_key: str) -> TaskRecord | None:
        return next(
            (
                record
                for record in list(self._tasks.values())
                if record.session_id == session_id
                and record.dedupe_key == dedupe_key
                and record.state not in (TaskState.FAILURE, TaskState.CANCELLED)
            ),
            None,
        )

    def drop_session(self, session_id: str) -> list[TaskRecord]:
        with self._lock:
            dropped = [r for r in self._tasks.values() if r.session_id == session_id]
            for record in dropped:
                del self._tasks[record.id]
            return dropped


task_store = TaskStore()
