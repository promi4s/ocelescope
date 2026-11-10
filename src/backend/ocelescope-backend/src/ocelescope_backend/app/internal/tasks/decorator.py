from __future__ import annotations

import hashlib
import inspect
from collections.abc import Callable
from typing import TYPE_CHECKING, Any, Generic, ParamSpec

from ocelescope_backend.app.internal.tasks.base import make_hashable
from ocelescope_backend.app.internal.tasks.inputs import find_open_entities
from ocelescope_backend.app.internal.tasks.outputs import TaskResult
from ocelescope_backend.app.internal.tasks.runner import task_runner

if TYPE_CHECKING:
    from ocelescope_backend.app.internal.session import Session

P = ParamSpec("P")


class Task(Generic[P]):
    def __init__(
        self,
        fn: Callable[P, TaskResult],
        name: str,
        hidden: bool,
        dedupe: bool,
        label: str | None,
    ) -> None:
        self.fn = fn
        self.name = name
        self.hidden = hidden
        self.dedupe = dedupe
        self.label = label
        qualname: str = fn.__qualname__  # ty: ignore[unresolved-attribute]
        self.function_ref = f"{fn.__module__}:{qualname}"
        self._signature = inspect.signature(fn)

        if label is not None and label not in self._signature.parameters:
            raise ValueError(
                f"Task {name!r}: label {label!r} is not a parameter of {qualname}"
            )

    def submit(self, session: Session, *args: P.args, **kwargs: P.kwargs) -> str:
        bound = self._signature.bind(*args, **kwargs)
        bound.apply_defaults()
        arguments = dict(bound.arguments)

        if entities := find_open_entities(arguments):
            raise TypeError(
                f"Task {self.name!r} got open {', '.join(entities)} objects; "
                "pass session.ocel_input(...) or session.resource_input(...) instead"
            )

        label = arguments.get(self.label) if self.label is not None else None

        return task_runner.submit(
            session,
            function_ref=self.function_ref,
            name=self.name,
            kwargs=arguments,
            hidden=self.hidden,
            label=None if label is None else str(label),
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
    label: str | None = None,
) -> Callable[[Callable[P, TaskResult]], Task[P]]:
    def decorator(fn: Callable[P, TaskResult]) -> Task[P]:
        task_name = name or fn.__name__  # ty: ignore[unresolved-attribute]
        return Task(fn, task_name, hidden, dedupe, label)

    return decorator
