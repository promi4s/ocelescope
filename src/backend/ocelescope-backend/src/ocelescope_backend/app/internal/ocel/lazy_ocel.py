"""A memory-efficient, DuckDB-backed OCEL used for dependency injection.

Where :class:`ocelescope.OCEL` holds every table in memory as pandas frames,
:class:`LazyOCEL` keeps the log on disk as a DuckDB database and only reads what a
caller asks for. It connects to the database read-only through **ibis** and exposes
each table as a lazy ibis expression, so a request can compose a query
(``lz.events.filter(...).group_by(...)``) and only pull the result it needs -- as
pandas (``.to_pandas()``) or polars (``.to_polars()``) -- or, when it truly needs
the full in-memory object, :meth:`materialize` it into an :class:`ocelescope.OCEL`.

Unlike the materialized OCEL, this view is *not* pm4py-shaped: ``events``,
``objects``, ``o2o`` and ``object_changes`` are the flat stored tables as-is, and
only ``relations`` is enriched -- the ``e2o`` table with the object ``ocel:type``
joined on. Nothing is reshaped or materialized until a query is executed.

This is a backend-only construct (it is what the ``ApiLazyOcel`` dependency
yields); the reshaping/loader primitives it builds on live in
:mod:`ocelescope.ocel.io`.
"""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

import ibis
from ocelescope.ocel.constants.pm4py import OID_COL, OTYPE_COL
from ocelescope.ocel.io import load_ocel_duckdb
from ocelescope.ocel.models.meta import OCELMeta

if TYPE_CHECKING:
    from ibis.expr.types import Table

    from ocelescope import OCEL


class LazyOCEL:
    """DuckDB-backed OCEL whose tables are lazy ibis expressions.

    Args:
        db_path: Path to a DuckDB database produced by ``convert_ocel_duckdb`` /
            ``dump_ocel_duckdb``.
        meta: Optional metadata, forwarded to :meth:`materialize`.
    """

    def __init__(self, db_path: str | Path, meta: OCELMeta | None = None):
        self.meta = meta or OCELMeta()
        self._db_path = Path(db_path)
        self._con = ibis.duckdb.connect(str(self._db_path), read_only=True)
        # DuckDB returns TIMESTAMPTZ in the session zone; pin it to UTC.
        self._con.raw_sql("SET TimeZone='UTC'")

    # ------------------------------------------------------------------
    # Tables (lazy ibis expressions)
    # ------------------------------------------------------------------
    @property
    def events(self) -> "Table":
        return self._con.table("events")

    @property
    def objects(self) -> "Table":
        return self._con.table("objects")

    @property
    def o2o(self) -> "Table":
        return self._con.table("o2o")

    @property
    def object_changes(self) -> "Table":
        return self._con.table("object_changes")

    @property
    def relations(self) -> "Table":
        """The ``e2o`` table with the object ``ocel:type`` joined on."""
        object_types = self._con.table("objects").select(OID_COL, OTYPE_COL)
        return self._con.table("e2o").join(object_types, OID_COL)

    # ------------------------------------------------------------------
    # Escape hatches
    # ------------------------------------------------------------------
    def sql(self, query: str) -> "Table":
        """Run arbitrary SQL against the stored tables, returning an ibis expression."""
        return self._con.sql(query)

    def materialize(self) -> "OCEL":
        """Load the full in-memory :class:`ocelescope.OCEL` (all tables into pandas)."""
        return load_ocel_duckdb(self._db_path, meta=self.meta)

    def close(self) -> None:
        self._con.disconnect()

    def __enter__(self) -> "LazyOCEL":
        return self

    def __exit__(self, *_exc) -> None:
        self.close()
