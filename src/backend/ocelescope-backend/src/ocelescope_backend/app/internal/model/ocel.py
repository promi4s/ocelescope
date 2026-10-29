import hashlib
import json
from collections import OrderedDict
from collections.abc import Sequence
from pathlib import Path

import duckdb
from ocelescope.ocel.io import export_duckdb_ocel
from ocelescope.ocel.view import ViewOperation
from ocelescope.util.sql import literal, set_utc

from ocelescope import OCEL
from ocelescope_backend.app.internal.exceptions import NotFound
from ocelescope_backend.app.internal.model.view import SessionView
from ocelescope_backend.app.sse_manager import Notify

MAX_TEMPORARY_VIEWS = 32


def _view_id(ocel_id: str, source: str, key: str) -> str:
    fingerprint = json.dumps([ocel_id, source, key])
    return hashlib.sha256(fingerprint.encode()).hexdigest()[:16]


class SessionOCEL:
    def __init__(
        self,
        id: str,
        db_path: Path,
        name: str,
        created_at: str,
        notify: Notify,
    ):
        self.id = id
        self.db_path = db_path
        self.name = name
        self.created_at = created_at
        self._notify = notify
        self._views: OrderedDict[str, SessionView] = OrderedDict()
        self.active_view_id: str | None = None

    def rename(self, name: str) -> None:
        self.name = name
        self._notify(["ocels"])

    @property
    def active_view(self) -> SessionView | None:
        if self.active_view_id is None:
            return None
        return self._views.get(self.active_view_id)

    @property
    def has_active_view(self) -> bool:
        return self.active_view is not None

    def prepare_view(self, view_id: str) -> None:
        view = self._views.get(view_id)
        if view is None:
            raise NotFound(f"View {view_id} not found")
        view.temporary = False
        view.materialize()

    def set_active_view(self, view_id: str | None) -> None:
        if view_id is not None:
            self.prepare_view(view_id)
        self.active_view_id = view_id
        self._notify(["ocels"])

    def open(self, use_original: bool = False) -> OCEL:
        view = None if use_original else self.active_view
        if view is None:
            return OCEL.read_duckdb(self.db_path, read_only=True)
        return view.open()

    def export(self, target_path: Path, use_original: bool = False) -> None:
        view = None if use_original else self.active_view
        if view is not None:
            view.materialize()
        source = self.db_path if view is None else view.path
        con = duckdb.connect(":memory:")
        try:
            set_utc(con)
            con.execute(f"ATTACH {literal(str(source))} AS source (READ_ONLY)")
            con.execute("USE source")
            export_duckdb_ocel(con, target_path)
        finally:
            con.close()

    def create_view(
        self,
        operations: Sequence[ViewOperation],
        source: str,
        key: str,
        name: str,
        temporary: bool = False,
    ) -> SessionView:
        id = _view_id(self.id, source, key)
        view = self._views.get(id)
        if view is None:
            view = self._views.setdefault(
                id,
                SessionView(
                    id=id,
                    origin=self,
                    name=name,
                    operations=operations,
                    source=source,
                    temporary=temporary,
                ),
            )
        if not temporary:
            view.name = name
            view.temporary = False

        self._views.move_to_end(id)
        evictable = [
            other_id
            for other_id, other in list(self._views.items())
            if other.temporary and other_id != self.active_view_id
        ]
        for other_id in evictable[: max(0, len(evictable) - MAX_TEMPORARY_VIEWS)]:
            evicted = self._views.pop(other_id, None)
            if evicted is not None:
                evicted.delete()
        return view

    def get_view(self, view_id: str) -> SessionView | None:
        view = self._views.get(view_id)
        if view is not None:
            self._views.move_to_end(view_id)
        return view

    def delete_view(self, view_id: str) -> SessionView | None:
        view = self._views.pop(view_id, None)
        if view is None:
            return None
        was_active = view_id == self.active_view_id
        if was_active:
            self.active_view_id = None
        view.delete()
        if was_active:
            self._notify(["ocels"])
        return view

    def delete(self) -> None:
        for view in self._views.values():
            view.delete()
        self._views.clear()
        self.db_path.unlink(missing_ok=True)
