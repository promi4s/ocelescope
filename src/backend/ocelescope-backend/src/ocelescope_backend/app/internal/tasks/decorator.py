from __future__ import annotations

import hashlib
import inspect
from collections.abc import Callable
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any, Generic, ParamSpec

from pydantic import BaseModel

from ocelescope_backend.app.internal.tasks.inputs import find_open_entities
from ocelescope_backend.app.internal.tasks.outputs import TaskResult
from ocelescope_backend.app.internal.tasks.runner import task_runner

if TYPE_CHECKING:
    from ocelescope_backend.app.internal.session import Session

P = ParamSpec("P")


def make_hashable(obj: Any) -> Any:
    if isinstance(obj, dict):
        return tuple(sorted((k, make_hashable(v)) for k, v in obj.items()))
    if isinstance(obj, list | tuple | set):
        return tuple(make_hashable(i) for i in obj)
    if isinstance(obj, BaseModel):
        return make_hashable(obj.model_dump())
    if isinstance(obj, Enum):
        return obj.value
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, str | int | float | bool | None):
        return obj
    return str(obj)


class Task(Generic[P]):
    def __init__(
        self,
        fn: Callable[P, TaskResult],
        name: str,
        hidden: bool,
        dedupe: bool,
    ) -> None:
        self.fn = fn
        self.name = name
        self.hidden = hidden
        self.dedupe = dedupe
        qualname: str = fn.__qualname__  # ty: ignore[unresolved-attribute]
        self.function_ref = f"{fn.__module__}:{qualname}"
        self._signature = inspect.signature(fn)

    def submit(self, session: Session, *args: P.args, **kwargs: P.kwargs) -> str:
        bound = self._signature.bind(*args, **kwargs)
        bound.apply_defaults()
        arguments = dict(bound.arguments)

        if entities := find_open_entities(arguments):
            raise TypeError(
                f"Task {self.name!r} got open {', '.join(entities)} objects; "
                "pass session.ocel_input(...) or session.resource_input(...) instead"
            )

        return task_runner.submit(
            session,
            function_ref=self.function_ref,
            name=self.name,
            arguments=arguments,
            hidden=self.hidden,
            dedupe_key=self._dedupe_key(arguments) if self.dedupe else None,
        )

    def _dedupe_key(self, arguments: dict[str, Any]) -> str:
        fingerprint = repr(make_hashable([self.function_ref, arguments]))
        return hashlib.sha256(fingerprint.encode()).hexdigest()


def task(
    name: str | None = None,
    *,
    hidden: bool = False,
    dedupe: bool = False,
) -> Callable[[Callable[P, TaskResult]], Task[P]]:
    def decorator(fn: Callable[P, TaskResult]) -> Task[P]:
        task_name = name or fn.__name__  # ty: ignore[unresolved-attribute]
        return Task(fn, task_name, hidden, dedupe)

    return decorator
