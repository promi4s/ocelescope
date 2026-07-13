from __future__ import annotations

import json
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Hashable, Sequence, Type, TypeVar, cast

from ocelescope.ocel.extensions.base_extension import OCELExtension
from ocelescope.ocel.io import convert_ocel_duckdb, dump_ocel_duckdb

from ocelescope import OCEL
from ocelescope_backend.app.internal.exceptions import NotFound
from ocelescope_backend.app.internal.model.ocel import SessionOCEL
from ocelescope_backend.app.internal.model.resource import ResourceApi, ResourceStore
from ocelescope_backend.app.internal.ocel.filters import ModuleFilter
from ocelescope_backend.app.internal.ocel.lazy_ocel import LazyOCEL
from ocelescope_backend.app.internal.tasks.base import TaskBase
from ocelescope_backend.app.sse_manager import InvalidationRequest, sse_manager

S = TypeVar("S", bound=TaskBase)
T = TypeVar("T")


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
        self._module_states: dict[str, Any] = {}

        # Resources
        self._resources: dict[str, ResourceStore] = {}

        # OCELS
        self.ocels: dict[str, SessionOCEL] = {}
        self._ocel_dir = Path(tempfile.mkdtemp(prefix=f"ocelescope_{self.id}_"))

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

    def get_module_state(self, key: str, state_cls: type[T]) -> T:
        state = self._module_states.get(key)

        if state is None:
            state = state_cls()
            self._module_states[key] = state

        return cast(T, state)

    def clear_module_state(self, key: str) -> None:
        self._module_states.pop(key, None)

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
    def _register_ocel(
        self,
        id: str,
        db_path: Path,
        name: str,
        created_at: str,
        extensions: list[OCELExtension] | None = None,
    ) -> str:
        self.ocels[id] = SessionOCEL(
            id=id,
            db_path=db_path,
            name=name,
            created_at=created_at,
            extensions=extensions,
        )
        sse_manager.send_safe(self.id, InvalidationRequest(routes=["ocels"]))
        return id

    def add_ocel(self, ocel: OCEL) -> str:
        """Persist an in-memory OCEL to a DuckDB file and register a handle."""
        ocel_id = ocel.meta.id
        db_path = self._ocel_dir / f"{ocel_id}.duckdb"
        dump_ocel_duckdb(ocel, db_path)

        return self._register_ocel(
            ocel_id,
            db_path,
            name=ocel.meta.extra.get("name") or "OCEL",
            created_at=ocel.meta.extra.get("upload_date") or datetime.now().isoformat(),
            extensions=ocel.extensions.all(),
        )

    def add_ocel_from_file(self, source_path: Path, name: str, created_at: str) -> str:
        """Stream an OCEL file straight into a DuckDB file without materializing it."""
        ocel_id = str(uuid.uuid4())
        db_path = self._ocel_dir / f"{ocel_id}.duckdb"
        convert_ocel_duckdb(source_path, db_path)

        return self._register_ocel(ocel_id, db_path, name=name, created_at=created_at)

    def set_ocel_extensions(self, ocel_id: str, extensions: list[OCELExtension]):
        """Attach in-memory extension instances to an already registered OCEL."""
        if ocel_id not in self.ocels:
            raise NotFound(f"OCEL with id {ocel_id} not found")

        self.ocels[ocel_id].extensions = extensions
        sse_manager.send_safe(self.id, InvalidationRequest(routes=["ocels"]))

    def get_ocel(self, ocel_id: str, use_original: bool = False) -> OCEL:
        if ocel_id not in self.ocels:
            raise NotFound(f"OCEL with id {ocel_id} not found")

        return self.ocels[ocel_id].ocel(use_original=use_original)

    def get_lazy_ocel(self, ocel_id: str, use_original: bool = False) -> LazyOCEL:
        if ocel_id not in self.ocels:
            raise NotFound(f"OCEL with id {ocel_id} not found")

        return self.ocels[ocel_id].lazy(use_original=use_original)

    def export_ocel(
        self, ocel_id: str, target_path: Path, use_original: bool = False
    ) -> None:
        """Stream an OCEL to a file straight from its DuckDB store (no full load)."""
        if ocel_id not in self.ocels:
            raise NotFound(f"OCEL with id {ocel_id} not found")

        self.ocels[ocel_id].export(target_path, use_original=use_original)

    def rename_ocel(self, ocel_id: str, new_name: str):
        if ocel_id not in self.ocels:
            raise NotFound(f"OCEL with id {ocel_id} not found")

        self.ocels[ocel_id].name = new_name
        sse_manager.send_safe(self.id, InvalidationRequest(routes=["ocels"]))

    def delete_ocel(self, ocel_id: str):
        handle = self.ocels.pop(ocel_id, None)
        if handle is None:
            return

        handle.delete()
        sse_manager.send_safe(self.id, InvalidationRequest(routes=["ocels"]))

    # endregion
    # region Resource management
    def get_filter(
        self, ocel_id: str, module_source: str | None = None
    ) -> list[ModuleFilter]:
        if ocel_id not in self.ocels:
            raise NotFound(f"OCEL with id {ocel_id} not found")

        return self.ocels[ocel_id].get_filters(module_source)

    def set_filter(
        self, ocel_id: str, module_source: str, pipeline: Sequence[ModuleFilter]
    ):
        if ocel_id not in self.ocels:
            raise NotFound(f"OCEL with id {ocel_id} not found")

        self.ocels[ocel_id].set_filters(module_source, pipeline)

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
