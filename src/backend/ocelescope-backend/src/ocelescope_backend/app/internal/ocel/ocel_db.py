"""A memory-efficient, DuckDB-backed reader for an OCEL.

``OCELDb`` is simply *another way to read an OCEL without loading the whole thing
into memory*: it opens a DuckDB file read-only and hands back each table as a lazy
DuckDB relation (``.df()`` for pandas, ``.pl()`` for polars, ``.fetchall()`` ...),
or the full pm4py :class:`ocelescope.OCEL` via :meth:`materialize` when needed.

It has no notion of filtering -- filtering is a *view* applied once when it is set
(see :mod:`.views`), which produces a filtered DuckDB file that this reader is then
pointed at. So a filtered ``OCELDb`` is just a reader over the pre-filtered file.
"""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

import duckdb
from ocelescope.ocel.constants.pm4py import (
    O2O_SOURCE_ID,
    O2O_TARGET_ID,
    OID_COL,
    OTYPE_COL,
)
from ocelescope.ocel.io import load_ocel_duckdb
from ocelescope.ocel.models.meta import OCELMeta

if TYPE_CHECKING:
    from ocelescope import OCEL


class OCELDb:
    """Read an OCEL DuckDB file table-by-table without materializing the whole log.

    ``events``, ``objects``, ``e2o``, ``o2o`` and ``object_changes`` are the flat
    stored tables; ``typed_e2o`` / ``typed_o2o`` add the related objects'
    ``ocel:type`` onto the relation tables. Each returns a lazy
    :class:`duckdb.DuckDBPyRelation`.

    Every access returns a relation on its *own* DuckDB cursor -- a single DuckDB
    connection can't be scanned twice in one query (e.g. when polars joins two of
    these frames), so **access ``ocel.events`` (etc.) freshly at each use rather
    than storing it in a variable and reusing it**.

    Args:
        db_path: Path to an OCEL DuckDB database (origin or a pre-filtered one).
        meta: Optional metadata, forwarded to :meth:`materialize`.
    """

    def __init__(self, db_path: str | Path, meta: OCELMeta | None = None):
        self.meta = meta or OCELMeta()
        self._db_path = Path(db_path)
        self._con = duckdb.connect(str(self._db_path), read_only=True)
        self._con.execute("SET TimeZone='UTC'")

    @property
    def db_path(self) -> Path:
        """Path to the underlying DuckDB file (e.g. to feed :func:`apply_filters`)."""
        return self._db_path

    @property
    def events(self) -> duckdb.DuckDBPyRelation:
        return self._con.cursor().table("events")

    @property
    def objects(self) -> duckdb.DuckDBPyRelation:
        return self._con.cursor().table("objects")

    @property
    def o2o(self) -> duckdb.DuckDBPyRelation:
        return self._con.cursor().table("o2o")

    @property
    def e2o(self) -> duckdb.DuckDBPyRelation:
        return self._con.cursor().table("e2o")

    @property
    def object_changes(self) -> duckdb.DuckDBPyRelation:
        return self._con.cursor().table("object_changes")

    @property
    def typed_e2o(self) -> duckdb.DuckDBPyRelation:
        """The ``e2o`` table with the object ``ocel:type`` joined on."""
        return self._con.cursor().sql(
            f'SELECT r.*, o."{OTYPE_COL}" FROM e2o r '
            f'JOIN objects o ON r."{OID_COL}" = o."{OID_COL}"'
        )

    @property
    def typed_o2o(self) -> duckdb.DuckDBPyRelation:
        """The ``o2o`` table with the source/target ``ocel:type`` joined on.

        The source object's type is exposed as ``ocel:type_1`` and the target's as
        ``ocel:type_2``, mirroring the ``ocel:oid_1`` / ``ocel:oid_2`` id columns.
        """
        return self._con.cursor().sql(
            f'SELECT r.*, s."{OTYPE_COL}" AS "{OTYPE_COL}_1", '
            f't."{OTYPE_COL}" AS "{OTYPE_COL}_2" FROM o2o r '
            f'JOIN objects s ON r."{O2O_SOURCE_ID}" = s."{OID_COL}" '
            f'JOIN objects t ON r."{O2O_TARGET_ID}" = t."{OID_COL}"'
        )

    def sql(
        self, query: str, params: list[object] | None = None
    ) -> duckdb.DuckDBPyRelation:
        """Run a read-only SQL query over the OCEL tables, returning a lazy relation.

        An escape hatch for reads the table properties + relational API can't express
        cleanly -- multi-table joins, list aggregation, window functions, and the like.
        Reference the stored tables by name (``events``, ``objects``, ``e2o``, ``o2o``,
        ``object_changes``, and the quantity tables when present). The query runs on its
        own cursor, so its result can still be combined with the other ``OCELDb``
        relations in a single follow-up query.

        Always bind caller-supplied values through ``params`` (``?`` placeholders) rather
        than formatting them into the query string, so they stay injection-safe.
        """
        cursor = self._con.cursor()
        return cursor.sql(query, params=params) if params else cursor.sql(query)

    def _has_table(self, name: str) -> bool:
        return (
            self._con.execute(
                "SELECT 1 FROM information_schema.tables WHERE table_name = ?", [name]
            ).fetchone()
            is not None
        )

    @property
    def has_quantities(self) -> bool:
        """Whether the OCEL carries a quantity extension (its tables are present)."""
        return self._has_table("quantities") or self._has_table("quantity_operations")

    @property
    def quantities(self) -> duckdb.DuckDBPyRelation | None:
        """Initial per-object quantities, or ``None`` without a quantity extension."""
        return (
            self._con.cursor().table("quantities")
            if self._has_table("quantities")
            else None
        )

    @property
    def quantity_operations(self) -> duckdb.DuckDBPyRelation | None:
        """Per-event quantity operations, or ``None`` without a quantity extension."""
        return (
            self._con.cursor().table("quantity_operations")
            if self._has_table("quantity_operations")
            else None
        )

    def materialize(self) -> "OCEL":
        """Load the full in-memory :class:`ocelescope.OCEL` (all tables into pandas)."""
        return load_ocel_duckdb(self._db_path, meta=self.meta)

    def close(self) -> None:
        self._con.close()

    def __enter__(self) -> "OCELDb":
        return self

    def __exit__(self, *_exc) -> None:
        self.close()
