from __future__ import annotations

import json
import uuid
from typing import Any, Callable, Hashable, Type, TypeVar, cast

from ocelescope import OCEL, BaseFilter

from app.internal.exceptions import NotFound
from app.internal.model.module import Module
from app.internal.model.ocel import SessionOCEL
from app.internal.model.resource import ResourceApi, ResourceStore
from app.internal.tasks.base import TaskBase
from app.sse_manager import InvalidationRequest, sse_manager

T = TypeVar("T", bound=Module)


S = TypeVar("S", bound=TaskBase)


class Session:
    sessions = {}

    def __init__(
        self,
        id: str | None = None,
    ):
        self.id = id or str(uuid.uuid4())

        # Tasks
        self._tasks: dict[str, TaskBase] = {}
        self._running_tasks: dict[str, TaskBase] = {}
        self._dedupe_keys: dict[Hashable, str] = {}  # dedupe key → task_id

        # Plugins
        self._module_states: dict[str, Module] = {}

        # Resources
        self._resources: dict[str, ResourceStore] = {}

        # OCELS
        self.ocels: dict[str, SessionOCEL] = {}

        self.response_cache: dict[str, Any] = {}
        # Set first state to UUID, to be updated on each response
        self.update_state()

        # Store session in static variable
        Session.sessions[self.id] = self

    @property
    def tasks(self):
        return self._tasks

    @property
    def running_tasks(self):
        return self._running_tasks

    def get_task(self, task_id: str):
        return self._tasks.get(task_id, None)

    def list_tasks(self, task_type: Type[S], filter: Callable[[S], bool]):
        return [
            task.summarize()
            for task in self._tasks.values()
            if isinstance(task, task_type) and filter(task)
        ]

    def get_module_state(self, key: str, cls: Type[T]) -> T:
        if key not in self._module_states:
            self._module_states[key] = cls()
        return cast(T, self._module_states[key])

    @staticmethod
    def get(session_id: str) -> Session | None:
        return Session.sessions.get(session_id, None)

    @staticmethod
    def info() -> str:
        return (
            "[\n  " + ",\n  ".join([str(s) for s in Session.sessions.values()]) + "\n]"
        )

    def update_state(self):
        self.state = str(uuid.uuid4())

    # region OCEL management
    def add_ocel(self, ocel: OCEL) -> str:
        self.ocels[ocel.meta.id] = SessionOCEL(ocel)

        return ocel.meta.id

    def get_ocel(self, ocel_id: str, use_original: bool = False) -> OCEL:
        if ocel_id not in self.ocels:
            raise NotFound(f"OCEL with id {ocel_id} not found")

        return (
            self.ocels[ocel_id].ocel if not use_original else self.ocels[ocel_id].origin
        )

    def delete_ocel(self, ocel_id: str):
        if ocel_id not in self.ocels:
            return

        self.ocels.pop(ocel_id, None)
        sse_manager.send_safe(self.id, InvalidationRequest(routes=["ocels"]))

    def get_ocel_filters(self, ocel_id: str) -> list[BaseFilter]:
        if ocel_id not in self.ocels:
            raise NotFound(f"OCEL with id {ocel_id} not found")

        return self.ocels[ocel_id].applied_filter

    def filter_ocel(self, ocel_id: str, pipeline: list[BaseFilter]) -> list[BaseFilter]:
        if ocel_id not in self.ocels:
            raise NotFound(f"OCEL with id {ocel_id} not found")

        self.ocels[ocel_id].apply_filter(pipeline)

        sse_manager.send_safe(self.id, InvalidationRequest(routes=["ocels"]))

        return self.ocels[ocel_id].applied_filter

    # endregion
    # region Resource management
    def add_resource(self, resource: ResourceStore) -> str:
        id = str(uuid.uuid4())

        self._resources[id] = resource

        sse_manager.send_safe(self.id, InvalidationRequest(routes=["resources"]))

        return id

    def get_resource(self, id: str) -> ResourceStore:
        if id not in self._resources:
            raise NotFound(f"Resource with id {id} not found")
        return self._resources[id]

    def delete_resource(self, id: str):
        self._resources.pop(id, None)
        sse_manager.send_safe(self.id, InvalidationRequest(routes=["resources"]))

    def list_resources(self) -> list[ResourceApi]:
        return list(
            ResourceApi(id=id, **resource.model_dump())
            for id, resource in self._resources.items()
        )

    def rename_resource(self, id: str, new_name: str):
        if id not in self._resources:
            raise NotFound(f"Resource with id {id} not found")

        self._resources[id].name = new_name
        sse_manager.send_safe(self.id, InvalidationRequest(routes=["resources"]))

    # endregion
    def invalidate_module_states(self):
        for module_state in self._module_states.values():
            module_state.clear_cache()

    def __str__(self):
        d = {
            k: v
            for k, v in {
                "id": self.id,
            }.items()
            if v is not None
        }
        return json.dumps(d, indent=2)

    def __repr__(self):
        return str(self)
