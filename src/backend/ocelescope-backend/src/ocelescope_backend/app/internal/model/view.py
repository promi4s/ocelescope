from __future__ import annotations

import threading
from collections.abc import Generator, Sequence
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from ocelescope.ocel.view import OCELView, ViewOperation

from ocelescope import OCEL

if TYPE_CHECKING:
    from ocelescope_backend.app.internal.model.ocel import SessionOCEL


class SessionView:
    def __init__(
        self,
        id: str,
        origin: SessionOCEL,
        name: str,
        operations: Sequence[ViewOperation],
        source: str | None = None,
        temporary: bool = False,
    ):
        self.id = id
        self.origin = origin
        self.name = name
        self.source = source
        self.temporary = temporary
        self.created_at = datetime.now(tz=UTC).isoformat()
        self.path = origin.db_path.with_name(f"{id}.duckdb")
        self.materialized = False
        self._lock = threading.Lock()

        with (
            OCEL.read_duckdb(origin.db_path, read_only=True) as ocel,
            OCELView(ocel) as view,
        ):
            view.apply(*operations)
            view.save(self.path)

    @property
    def ocel_id(self) -> str:
        return self.origin.id

    def materialize(self) -> None:
        with self._lock:
            if self.materialized:
                return
            building = self.path.with_suffix(".building")
            OCELView.materialize(self.path, building)
            building.replace(self.path)
            self.materialized = True

    def open(self) -> OCEL:
        with self._lock:
            if self.materialized:
                return OCEL.read_duckdb(self.path, read_only=True)
            return OCELView.load(self.path)

    @contextmanager
    def ocel(self) -> Generator[OCEL]:
        with self.open() as ocel:
            yield ocel

    def close(self) -> None:
        with self._lock:
            self.path.unlink(missing_ok=True)
            self.path.with_suffix(".building").unlink(missing_ok=True)
            self.materialized = False
