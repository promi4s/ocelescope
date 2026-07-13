"""A memory-efficient, DuckDB-backed reader for an OCEL.

``LazyOCEL`` is simply *another way to read an OCEL without loading the whole thing
into memory*: it opens a DuckDB file read-only and hands back each table as a lazy
DuckDB relation (``.df()`` for pandas, ``.pl()`` for polars, ``.fetchall()`` ...),
or the full pm4py :class:`ocelescope.OCEL` via :meth:`materialize` when needed.

It has no notion of filtering -- filtering is a *view* applied once when it is set
(see :mod:`.views`), which produces a filtered DuckDB file that this reader is then
pointed at. So a filtered ``LazyOCEL`` is just a reader over the pre-filtered file.
"""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

import duckdb
from ocelescope.ocel.constants.pm4py import OID_COL, OTYPE_COL
from ocelescope.ocel.io import load_ocel_duckdb
from ocelescope.ocel.models.meta import OCELMeta

if TYPE_CHECKING:
    from ocelescope import OCEL


class LazyOCEL:
    """Read an OCEL DuckDB file table-by-table without materializing the whole log.

    ``events``, ``objects``, ``o2o`` and ``object_changes`` are the flat stored
    tables; ``relations`` is ``e2o`` with the object ``ocel:type`` joined on. Each
    returns a lazy :class:`duckdb.DuckDBPyRelation`.

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
    def events(self) -> duckdb.DuckDBPyRelation:
        return self._con.table("events")

    @property
    def objects(self) -> duckdb.DuckDBPyRelation:
        return self._con.table("objects")

    @property
    def o2o(self) -> duckdb.DuckDBPyRelation:
        return self._con.table("o2o")

    @property
    def object_changes(self) -> duckdb.DuckDBPyRelation:
        return self._con.table("object_changes")

    @property
    def relations(self) -> duckdb.DuckDBPyRelation:
        """The ``e2o`` table with the object ``ocel:type`` joined on."""
        return self._con.sql(
            f'SELECT r.*, o."{OTYPE_COL}" FROM e2o r '
            f'JOIN objects o ON r."{OID_COL}" = o."{OID_COL}"'
        )

    def sql(self, query: str) -> duckdb.DuckDBPyRelation:
        """Run arbitrary SQL against the stored tables."""
        return self._con.sql(query)

    def materialize(self) -> "OCEL":
        """Load the full in-memory :class:`ocelescope.OCEL` (all tables into pandas)."""
        return load_ocel_duckdb(self._db_path, meta=self.meta)

    def close(self) -> None:
        self._con.close()

    def __enter__(self) -> "LazyOCEL":
        return self

    def __exit__(self, *_exc) -> None:
        self.close()
