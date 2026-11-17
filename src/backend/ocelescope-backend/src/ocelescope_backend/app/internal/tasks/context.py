from __future__ import annotations

from dataclasses import dataclass
from multiprocessing.connection import Connection
from pathlib import Path

from ocelescope_backend.app.sse_manager import ErrorNotification, SystemNotification


@dataclass
class TaskContext:
    task_id: str
    work_dir: Path
    _channel: Connection

    def notify(self, notification: SystemNotification | ErrorNotification) -> None:
        self._channel.send(("notify", notification))


_current: TaskContext | None = None


def set_task_context(context: TaskContext | None) -> None:
    global _current
    _current = context


def task_context() -> TaskContext:
    if _current is None:
        raise RuntimeError("task_context() can only be called inside a running task")
    return _current
