from __future__ import annotations

from contextlib import contextmanager
from typing import TYPE_CHECKING, Any, Iterator

import duckdb

from ocelescope.util.sql import ident, set_utc

if TYPE_CHECKING:
    from ocelescope.ocel.core.ocel import OCEL

#: View name a table's incoming contents are bound to while being written.
_INCOMING = "_incoming_table"


class BaseManager:
    """Base class for all managers, holding their shared access to the database."""

    def __init__(self, ocel: "OCEL"):
        self._ocel = ocel

    def _has_table(self, name: str) -> bool:
        """Whether a table called ``name`` exists in the OCEL's database."""
        return (
            self._ocel.con.execute(
                "SELECT 1 FROM information_schema.tables WHERE table_name = ?", [name]
            ).fetchone()
            is not None
        )

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

    def _column_names(self, table: str) -> list[str]:
        """The columns of a stored table, in their stored order."""
        return [name for name, *_ in self._ocel.con.execute(f"DESCRIBE {ident(table)}").fetchall()]

    def _attribute_names(self, table: str) -> list[str]:
        """The attribute columns of a stored table: its columns minus the OCEL ones."""
        return sorted(name for name in self._column_names(table) if not name.startswith("ocel:"))

    @contextmanager
    def _bound(self, contents: Any) -> Iterator[str]:
        """Bind ``contents`` to the OCEL's connection for one query, as a view."""
        con = self._ocel.con
        if isinstance(contents, duckdb.DuckDBPyRelation):
            contents = contents.to_arrow_table()
        con.register(_INCOMING, contents)
        try:
            yield _INCOMING
        finally:
            con.unregister(_INCOMING)

    def _replace(self, table: str, contents: Any, projection: str = "*") -> None:
        """Replace stored ``table`` with ``contents``, projected through ``projection``."""
        with self._bound(contents) as incoming:
            self._ocel.con.execute(
                f'CREATE OR REPLACE TABLE "{table}" AS SELECT {projection} FROM {incoming}'
            )
