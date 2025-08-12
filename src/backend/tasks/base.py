from abc import ABC
from datetime import datetime
import inspect
import threading
from enum import Enum
import uuid

from typing import TYPE_CHECKING, Callable, TypeVar


from pydantic.main import BaseModel


if TYPE_CHECKING:
    pass


class TaskState(str, Enum):
    PENDING = "PENDING"
    STARTED = "STARTED"
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    SKIPPED = "SKIPPED"
    CANCELLED = "CANCELLED"


def make_hashable(obj):
    if isinstance(obj, dict):
        return tuple(sorted((k, make_hashable(v)) for k, v in obj.items()))
    elif isinstance(obj, (list, tuple, set)):
        return tuple(make_hashable(i) for i in obj)
    elif isinstance(obj, BaseModel):
        return make_hashable(obj.model_dump())
    elif isinstance(obj, Enum):
        return obj.value
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, (str, int, float, bool, type(None))):
        return obj
    else:
        return str(obj)  # fallback to string representation


P = TypeVar("P")


def _call_with_known_params(fn: Callable[..., P], *args, **kwargs) -> P:
    sig = inspect.signature(fn)
    allowed = sig.parameters.keys()
    filtered = {k: v for k, v in kwargs.items() if k in allowed}
    return fn(*args, **filtered)


class TaskSummary(BaseModel, ABC):
    id: str
    state: TaskState
    pass


class TaskBase:
    def __init__(self):
        self.id = str(uuid.uuid4())
        self.state = TaskState.PENDING
        self.thread = None
        self.stop_event = threading.Event()

    def start(self):
        self.thread = threading.Thread(target=self.run, daemon=True)
        self.thread.start()

    def run(self):
        pass

    def cancel(self):
        self.stop_event.set()
        self.state = TaskState.CANCELLED

    def join(self, timeout=None):
        if self.thread:
            self.thread.join(timeout)

    def summarize(self) -> TaskSummary:
        raise NotImplementedError("")
