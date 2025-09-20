import functools
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Generic,
    Hashable,
    ParamSpec,
    Optional,
    Sequence,
)

from api.websocket import (
    WebsocketMessage,
    websocket_manager,
)

from tasks.base import (
    TaskBase,
    TaskState,
    TaskSummary,
    make_hashable,
    _call_with_known_params,
)

if TYPE_CHECKING:
    from api.session import Session

P = ParamSpec("P")


class SystemTaskSummary(TaskSummary):
    name: str
    metadata: dict[str, Any]


class SystemTask(TaskBase, Generic[P]):
    def __init__(
        self,
        *,
        args: tuple[Any, ...],
        kwargs: dict[str, Any],
        fn: Callable[P, list[WebsocketMessage]],
        name: str,
        metadata: dict[str, Any] = {},
        session: "Session",
    ):
        # TaskBase in your setup expects (fn, args, kwargs)
        super().__init__()
        self.args = args
        self.kwargs = kwargs
        self.fn = fn
        self.name = name
        self.session = session
        self.error: Optional[BaseException] = None
        self.result: Sequence[WebsocketMessage] = []
        self.metadata = metadata

    def run(self):
        self.state = TaskState.STARTED
        try:
            self.result = _call_with_known_params(
                self.fn,
                *self.args,
                session=self.session,
                stop_event=self.stop_event,
                metadata=self.metadata,
                **self.kwargs,
            )
            if self.state != TaskState.CANCELLED:
                self.state = TaskState.SUCCESS
        except Exception as exc:
            self.error = exc
            self.state = TaskState.FAILURE
            raise
        finally:
            self.session.running_tasks.pop(self.id, None)
            for result in self.result:
                websocket_manager.send_safe(self.session.id, result)

    def summarize(self) -> SystemTaskSummary:
        return SystemTaskSummary(
            id=self.id, state=self.state, name=self.name, metadata=self.metadata
        )

    @staticmethod
    def _dedupe_key(
        task_name: str,
        args: tuple[Any, ...],
        kwargs: dict[str, Any],
        *,
        run_once: bool,
    ) -> Hashable:
        return (
            ("system_task", task_name)
            if run_once
            else ("system_task", task_name, make_hashable(args), make_hashable(kwargs))
        )

    @classmethod
    def create_system_task(
        cls,
        fn: Callable[P, Any],
        *,
        args: tuple[Any, ...],
        kwargs: dict[str, Any],
        session: "Session",
        task_name: str,
        run_once: bool = False,
        dedupe: bool = False,
        metadata: dict[str, Any] = {},
    ) -> str:
        key = cls._dedupe_key(task_name, args, kwargs, run_once=run_once)

        if dedupe or run_once:
            existing_id = session._dedupe_keys.get(key)
            if existing_id and existing_id in session.tasks:
                print(f"[Task: {task_name}] Skipped (deduplicated) -> {existing_id}")
                return existing_id

        task = cls(
            fn=fn,
            args=args,
            kwargs=kwargs,
            name=task_name,
            session=session,
            metadata=metadata,
        )
        session.tasks[task.id] = task
        session.running_tasks[task.id] = task
        if dedupe or run_once:
            session._dedupe_keys[key] = task.id

        print(f"[Task: {task_name}] Starting in thread (ID: {task.id})")
        task.start()
        return task.id


def system_task(
    name: Optional[str] = None, dedupe: bool = False, run_once: bool = False
) -> Callable[[Callable[P, Sequence[WebsocketMessage]]], Callable[P, str]]:
    def decorator(fn: Callable[P, Sequence[WebsocketMessage]]) -> Callable[P, str]:
        task_name = name or fn.__name__

        @functools.wraps(fn)
        def wrapper(
            *args: Any, session: "Session", metadata: dict[str, Any] = {}, **kwargs: Any
        ) -> str:
            return SystemTask.create_system_task(
                fn=fn,
                args=args,
                kwargs=kwargs,
                session=session,
                task_name=task_name,
                run_once=run_once,
                metadata=metadata,
                dedupe=dedupe,
            )

        return wrapper

    return decorator
