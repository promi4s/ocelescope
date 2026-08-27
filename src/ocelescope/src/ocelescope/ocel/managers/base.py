from __future__ import annotations

from contextlib import contextmanager
from typing import TYPE_CHECKING, Any, Iterator

import duckdb
import polars

from ocelescope.ocel.io.schema import FIXED_COLUMN_TYPES
from ocelescope.util.sql import set_utc

if TYPE_CHECKING:
    from ocelescope.ocel.core.ocel import OCEL

_INCOMING = "_incoming_table"


class BaseManager:
    """Base class for all managers, holding their shared access to the database."""

    def __init__(self, ocel: "OCEL"):
        self._ocel = ocel

    def _relation(self, sql: str, params: list[object] | None = None) -> duckdb.DuckDBPyRelation:
        """A lazy relation for ``sql``, on its own DuckDB cursor."""
        cursor = self._ocel.con.cursor()
        set_utc(cursor)
        return cursor.sql(sql, params=params) if params else cursor.sql(sql)

    def _column(self, sql: str, params: list[object] | None = None) -> list[Any]:
        """The first column of ``sql``'s result, as a list.

        For the many summaries that are one column of a handful of rows -- type
        names, qualifiers -- where a frame would be a detour.
        """
        return [row[0] for row in self._relation(sql, params).fetchall()]

    @contextmanager
    def _bound(self, contents: Any) -> Iterator[str]:
        """Bind ``contents`` to the OCEL's connection for one query, as a view.

        Anything still lazy is read out first. A relation or a LazyFrame taken off
        a getter reads the very tables the caller is about to write, and a writer
        that takes more than one statement would otherwise see it change under it:
        the rows it means to store are gone by the time it stores them.
        """
        con = self._ocel.con
        if isinstance(contents, duckdb.DuckDBPyRelation):
            contents = contents.to_arrow_table()
        elif isinstance(contents, polars.LazyFrame):
            contents = contents.collect()
        con.register(_INCOMING, contents)
        try:
            yield _INCOMING
        finally:
            con.unregister(_INCOMING)

    def _replace(self, table: str, contents: Any, projection: str = "*") -> None:
        """Replace stored ``table`` with ``contents``, projected through ``projection``.

        The table's fixed columns are cast to the types the schema gives them,
        whatever types ``contents`` carries. A frame that arrives empty carries
        none worth keeping -- DuckDB reads a column of nothing as INTEGER, and an
        id column stored that way refuses every later comparison against a real
        one.
        """
        con = self._ocel.con
        fixed = FIXED_COLUMN_TYPES.get(table, {})

        with self._bound(contents) as incoming:
            source = f"(SELECT {projection} FROM {incoming})"
            columns = {name for name, *_ in con.execute(f"DESCRIBE {source}").fetchall()}
            pinned = ", ".join(
                f'"{name}"::{dtype} AS "{name}"' for name, dtype in fixed.items() if name in columns
            )
            replace = f" REPLACE ({pinned})" if pinned else ""
            con.execute(f'CREATE OR REPLACE TABLE "{table}" AS SELECT *{replace} FROM {source}')
