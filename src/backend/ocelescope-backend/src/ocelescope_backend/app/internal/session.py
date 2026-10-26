from __future__ import annotations

import json
import shutil
import tempfile
from collections.abc import Callable, Generator, Hashable, Sequence
from contextlib import AbstractContextManager, contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, ClassVar, Self, TypeVar, overload
from uuid import uuid4

from ocelescope import OCEL, BaseFilter, ResourceBase
from ocelescope_backend.app.internal.exceptions import BadRequest, NotFound
from ocelescope_backend.app.internal.model.ocel import SessionOCEL
from ocelescope_backend.app.internal.model.resource import ResourceApi, ResourceStore
from ocelescope_backend.app.internal.model.state import StateStore
from ocelescope_backend.app.internal.registry import registry_manager
from ocelescope_backend.app.internal.tasks.base import TaskBase
from ocelescope_backend.app.sse_manager import InvalidationRequest, sse_manager

S = TypeVar("S", bound=TaskBase)
T = TypeVar("T")
R = TypeVar("R", bound=ResourceBase)


class Session:
    sessions: ClassVar[dict[str, Self]] = {}

    def __init__(
        self,
        id: str | None = None,
    ):
        self.id = id or str(uuid4())

        # Tasks
        self._tasks: dict[str, TaskBase] = {}
        self._dedupe_keys: dict[Hashable, str] = {}  # dedupe key → task_id

        # Plugins
        self.module_states = StateStore()

        # Resources
        self._resources: dict[str, ResourceStore] = {}
        self._resource_dir = Path(
            tempfile.mkdtemp(prefix=f"ocelescope_{self.id}_resources_")
        )

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

    def get_task(self, task_id: str):
        return self._tasks.get(task_id, None)

    def list_tasks(self, task_type: type[S], filter: Callable[[S], bool]):
        return [
            task.summarize()
            for task in self._tasks.values()
            if isinstance(task, task_type) and filter(task)
        ]

    @staticmethod
    def get(session_id: str) -> Session | None:
        return Session.sessions.get(session_id, None)

    @staticmethod
    def info() -> str:
        return (
            "[\n  " + ",\n  ".join([str(s) for s in Session.sessions.values()]) + "\n]"
        )

    def update_state(self):
        self.state = str(uuid4())

    def close(self) -> None:
        """Forget the session and delete the files of its OCELs and resources."""
        Session.sessions.pop(self.id, None)
        shutil.rmtree(self._ocel_dir, ignore_errors=True)
        shutil.rmtree(self._resource_dir, ignore_errors=True)

    # region OCEL management
    def dump_ocel(self, ocel: OCEL) -> Path:
        """Persist an OCEL to its own DuckDB file without adding it to the session."""
        db_path = self._ocel_dir / f"{uuid4()}.duckdb"
        ocel.to_duckdb(db_path)
        return db_path

    def add_ocel(self, ocel: OCEL | Path, name: str) -> str:
        """Add an OCEL to the session.

        ``ocel`` is either an OCEL, which is dumped, or a DuckDB file written by
        :meth:`dump_ocel` (e.g. a plugin result), which is copied.
        """
        if isinstance(ocel, OCEL):
            db_path = self.dump_ocel(ocel)
        else:
            db_path = self._ocel_dir / f"{uuid4()}.duckdb"
            shutil.copyfile(ocel, db_path)

        id = str(uuid4())
        self.ocels[id] = SessionOCEL(
            id=id,
            db_path=db_path,
            name=name,
            created_at=datetime.now(tz=UTC).isoformat(),
        )
        sse_manager.send_safe(self.id, InvalidationRequest(routes=["ocels"]))

        return id

    def get_ocel(self, ocel_id: str, use_original: bool = False) -> OCEL:
        if ocel_id not in self.ocels:
            raise NotFound(f"OCEL with id {ocel_id} not found")

        return self.ocels[ocel_id].ocel(use_original=use_original)

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

        self.module_states.drop_ocel(ocel_id)
        handle.delete()
        sse_manager.send_safe(self.id, InvalidationRequest(routes=["ocels"]))

    # endregion
    # region Resource management
    def get_filter(
        self, ocel_id: str, module_source: str | None = None
    ) -> list[BaseFilter]:
        if ocel_id not in self.ocels:
            raise NotFound(f"OCEL with id {ocel_id} not found")

        return self.ocels[ocel_id].get_filters(module_source)

    def set_filter(
        self, ocel_id: str, module_source: str, pipeline: Sequence[BaseFilter]
    ):
        if ocel_id not in self.ocels:
            raise NotFound(f"OCEL with id {ocel_id} not found")

        self.ocels[ocel_id].set_filters(module_source, pipeline)

    # endregion
    # region Resource management
    def dump_resource(
        self, resource: ResourceBase, name: str, source_id: str | None = None
    ) -> ResourceStore:
        """Dump a resource into its own file without adding it to the session."""
        path = self._resource_dir / str(uuid4())
        try:
            resource.dump(path)
        except Exception:
            path.unlink(missing_ok=True)
            raise

        return ResourceStore(
            path=path,
            name=name,
            schema_hash=resource.get_schema_hash(),
            source_id=source_id,
        )

    def add_resource(
        self,
        resource: ResourceBase | ResourceStore,
        name: str,
        source_id: str | None = None,
    ) -> str:
        """Add a resource to the session.

        ``resource`` is either a resource, which is dumped, or a store written by
        :meth:`dump_resource` (e.g. a plugin result), whose file is copied.
        """
        if isinstance(resource, ResourceBase):
            store = self.dump_resource(resource, name, source_id)
        else:
            path = self._resource_dir / str(uuid4())
            shutil.copyfile(resource.path, path)
            store = ResourceStore(
                path=path,
                name=name,
                schema_hash=resource.schema_hash,
                source_id=source_id or resource.source_id,
            )

        id = str(uuid4())
        self._resources[id] = store
        sse_manager.send_safe(self.id, InvalidationRequest(routes=["resources"]))

        return id

    def get_resource(self, id: str) -> ResourceStore:
        if id not in self._resources:
            raise NotFound(f"Resource with id {id} not found")
        return self._resources[id]

    def _resource_class(
        self, store: ResourceStore, resource_class: type[R] | None
    ) -> type[R | ResourceBase]:
        if resource_class is None:
            return registry_manager.get_resource_class(store.schema_hash)
        if store.schema_hash != resource_class.get_schema_hash():
            raise BadRequest(f"Resource is not a {resource_class.__name__}.")
        return resource_class

    @overload
    def load_resource(self, id: str) -> ResourceBase: ...
    @overload
    def load_resource(self, id: str, resource_class: type[R]) -> R: ...
    def load_resource(
        self, id: str, resource_class: type[R] | None = None
    ) -> R | ResourceBase:
        """An in-memory copy of the stored resource the caller may modify.

        ``resource_class`` defaults to the class registered for its schema hash.

        Raises:
            NotFound: If there is no resource with ``id``.
            BadRequest: If the resource is not a ``resource_class``.
        """
        store = self.get_resource(id)
        return self._resource_class(store, resource_class).load(
            store.path, resolve=registry_manager.get_resource_class
        )

    @overload
    def open_resource(self, id: str) -> AbstractContextManager[ResourceBase]: ...
    @overload
    def open_resource(
        self, id: str, resource_class: type[R]
    ) -> AbstractContextManager[R]: ...
    def open_resource(
        self, id: str, resource_class: type[R] | None = None
    ) -> AbstractContextManager[R | ResourceBase]:
        """A read-only view on the stored resource, valid for the block.

        Raises:
            NotFound: If there is no resource with ``id``.
            BadRequest: If the resource is not a ``resource_class``.
        """
        return self.open_store(self.get_resource(id), resource_class)

    @contextmanager
    def open_store(
        self, store: ResourceStore, resource_class: type[R] | None = None
    ) -> Generator[R | ResourceBase]:
        """A read-only view on a dumped resource, valid for the block."""
        with self._resource_class(store, resource_class).open(
            store.path, resolve=registry_manager.get_resource_class
        ) as resource:
            yield resource

    def delete_resource(self, id: str):
        store = self._resources.pop(id, None)
        if store is not None:
            store.delete()
        sse_manager.send_safe(self.id, InvalidationRequest(routes=["resources"]))

    def list_resources(self) -> list[ResourceApi]:
        resource_info = registry_manager.get_resource_info()

        return [
            ResourceApi(
                id=id,
                resource_type_label=resource_info[resource.schema_hash]["label"],
                **resource.model_dump(),
            )
            for id, resource in self._resources.items()
            if resource.schema_hash in resource_info
        ]

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
