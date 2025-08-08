from __future__ import annotations

import json
import uuid
from typing import Any, Optional, Type, TypeVar, cast

from api.exceptions import NotFound
from api.model.module import Module
from api.model.ocel import Filtered_Ocel
from api.model.tasks import TaskSummary
from ocelescope import OCEL, OCELFilter, Resource as ResourceBase
from api.model.resource import Resource
from util.tasks import Task


T = TypeVar("T", bound=Module)  # Constrain T to CachableObject


class Session:
    sessions = {}

    def __init__(
        self,
        id: str | None = None,
    ):
        self.id = id or str(uuid.uuid4())

        # Tasks
        self._tasks: dict[str, Task] = {}
        self._running_tasks: dict[str, Task] = {}
        self._dedupe_keys: dict[tuple, str] = {}  # dedupe key → task_id

        # Plugins
        self._module_states: dict[str, Module] = {}

        # Resources
        self._resources: dict[str, Resource] = {}

        # OCELS
        self.ocels: dict[str, Filtered_Ocel] = {}
        self.current_ocel_id = None

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

    def list_tasks(self) -> list[TaskSummary]:
        return [
            TaskSummary(
                key=task.id,
                name=task.name,
                state=task.state,
                result=task.result,
                metadata=task.metadata,
            )
            for task in self._tasks.values()
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
        self.ocels[ocel.id] = Filtered_Ocel(ocel)

        if not self.current_ocel_id:
            self.current_ocel_id = ocel.id

        return ocel.id

    def get_ocel(
        self, ocel_id: Optional[str] = None, use_original: bool = False
    ) -> OCEL:
        id = ocel_id if ocel_id is not None else self.current_ocel_id

        if id not in self.ocels:
            raise NotFound(f"OCEL with id {ocel_id} not found")
        ocel = self.ocels[id]

        return (
            ocel.filtered
            if (ocel.filtered is not None and not use_original)
            else ocel.original
        )

    def set_current_ocel(self, ocel_id: str):
        if ocel_id not in self.ocels:
            raise NotFound(f"OCEL with id {ocel_id} not found")

        self.current_ocel_id = ocel_id

    def delete_ocel(self, ocel_id: str):
        if ocel_id not in self.ocels:
            return

        if ocel_id == self.current_ocel_id:
            self.current_ocel_id = None

        self.ocels.pop(ocel_id, None)

    def get_ocel_filters(self, ocel_id: str) -> Optional[OCELFilter]:
        if ocel_id not in self.ocels:
            raise NotFound(f"OCEL with id {ocel_id} not found")

        return self.ocels[ocel_id].filter or None

    def filter_ocel(
        self, ocel_id: str, filters: Optional[OCELFilter]
    ) -> Optional[OCELFilter]:
        if ocel_id not in self.ocels:
            raise NotFound(f"OCEL with id {ocel_id} not found")

        current_ocel = self.ocels[ocel_id]
        if filters is None:
            current_ocel.filtered = None
            current_ocel.filter = None
            return

        current_ocel.filtered = current_ocel.original.apply_filter(filters)
        current_ocel.filter = filters

    # endregion
    # region Output management
    def add_resource(self, output: ResourceBase, name: str) -> str:
        outputWrapper = Resource(resource=output, name=name)
        self._resources[outputWrapper.id] = outputWrapper
        return outputWrapper.id

    def get_resource(self, id: str) -> Resource:
        if id not in self._resources:
            raise NotFound(f"Resource with id {id} not found")
        return self._resources[id]

    def delete_resource(self, id: str):
        self._resources.pop(id, None)

    def list_resources(self) -> list[Resource]:
        return list(self._resources.values())

    def rename_resource(self, output_id: str, new_name: str):
        if output_id not in self._resources:
            raise NotFound(f"Output with id {output_id} not found")

        self._resources[output_id].name = new_name

    # endregion
    def invalidate_module_states(self):
        for module_state in self._module_states.values():
            module_state.clear_cache()

    def __str__(self):
        d = {
            k: v
            for k, v in {
                "id": self.id,
                "ocel": str(self.get_ocel()) if self.get_ocel() else None,
            }.items()
            if v is not None
        }
        return json.dumps(d, indent=2)

    def __repr__(self):
        return str(self)


def save_response_to_cache(route: str):
    return route != "task-status"


def add_from_response_cache(route: str):
    return route == "load"
