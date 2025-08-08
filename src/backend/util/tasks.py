from datetime import datetime
import threading
import functools
from enum import Enum
import uuid

from typing import TYPE_CHECKING, Any, Optional
from api.websocket import TaskMessage, websocket_manager

from pydantic.main import BaseModel

from ocelescope import OCEL, Resource

if TYPE_CHECKING:
    from api.session import Session


class TaskState(str, Enum):
    PENDING = "PENDING"
    STARTED = "STARTED"
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    SKIPPED = "SKIPPED"
    CANCELLED = "CANCELLED"


class TaskResult(BaseModel):
    ocel_ids: list[str]
    output_ids: list[str]


class Task:
    def __init__(self, id, name, message, fn, args, kwargs, session, metadata=None):
        self.id = id
        self.name = name
        self.fn = fn
        self.args = args
        self.kwargs = kwargs
        self.session: Session = session
        self.metadata = metadata or {}
        self.state = TaskState.PENDING
        self.thread = None
        self.result: Optional[TaskResult] = None
        self.stop_event = threading.Event()
        self.message = message

    def start(self):
        self.thread = threading.Thread(target=self.run, daemon=True)
        self.thread.start()

    def run(self):
        self.state = TaskState.STARTED
        try:
            result = self.fn(
                *self.args,
                session=self.session,
                stop_event=self.stop_event,
                **self.kwargs,
            )
            result_items = result if isinstance(result, (list, tuple)) else [result]
            self.result = TaskResult(**{"ocel_ids": [], "output_ids": []})
            for result in result_items:
                if isinstance(result, OCEL):
                    self.result.ocel_ids.append(self.session.add_ocel(result))
                if isinstance(result, Resource):
                    self.result.output_ids.append(
                        self.session.add_resource(
                            output=result,
                            name=f"{result.type}_{datetime.now().strftime('%Y-%m-%d_%H:%M')}",  # type: ignore
                        )
                    )

            self.state = TaskState.SUCCESS
        except Exception:
            self.state = TaskState.FAILURE
            raise
        finally:
            self.session.running_tasks.pop(self.id, None)
            websocket_manager.send_safe(
                self.session.id,
                TaskMessage(
                    task_id=self.id,
                    task_message=self.message,
                    ocel_ids=self.result.ocel_ids if self.result is not None else None,
                    output_ids=self.result.output_ids
                    if self.result is not None
                    else None,
                ),
            )

    def cancel(self):
        self.stop_event.set()
        self.state = TaskState.CANCELLED

    def join(self, timeout=None):
        if self.thread:
            self.thread.join(timeout)


def make_hashable(obj):
    if isinstance(obj, dict):
        return tuple(sorted((k, make_hashable(v)) for k, v in obj.items()))
    elif isinstance(obj, (list, tuple, set)):
        return tuple(make_hashable(i) for i in obj)
    elif isinstance(obj, BaseModel):
        return make_hashable(obj.dict())
    elif isinstance(obj, Enum):
        return obj.value
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, (str, int, float, bool, type(None))):
        return obj
    else:
        return str(obj)  # fallback to string representation


def task(
    name=None, dedupe=False, run_once=False, success_message: Optional[str] = None
):
    def decorator(fn):
        task_name = name or fn.__name__

        @functools.wraps(fn)
        def wrapper(
            *args,
            session: "Session",
            metadata: dict[str, Any] = {},
            **kwargs,
        ):
            # Compute a hashable deduplication key
            dedupe_key = (
                task_name
                if run_once
                else (task_name, make_hashable(args), make_hashable(kwargs))
            )

            # Deduplication check
            if dedupe or run_once:
                task_id = session._dedupe_keys.get(dedupe_key)
                if task_id and task_id in session.tasks:
                    print(f"[Task: {task_name}] Skipped (deduplicated)")
                    return task_id

            # Always create a unique task ID
            task_id = str(uuid.uuid4())
            task_obj = Task(
                id=task_id,
                name=task_name,
                fn=fn,
                args=args,
                kwargs=kwargs,
                session=session,
                metadata=metadata,
                message=success_message,
            )

            # Register task
            session.tasks[task_id] = task_obj
            session.running_tasks[task_id] = task_obj
            if dedupe or run_once:
                session._dedupe_keys[dedupe_key] = task_id

            print(f"[Task: {task_name}] Starting in thread (ID: {task_id})")
            task_obj.start()
            return task_id

        return wrapper

    return decorator
