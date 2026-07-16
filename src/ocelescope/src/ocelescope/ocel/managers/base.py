from __future__ import annotations

from contextlib import contextmanager
from typing import TYPE_CHECKING, Any, Iterator

import duckdb

from ocelescope.util.sql import ident

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
        """A lazy relation for ``sql``, on its own DuckDB cursor.

        A cursor is a second connection to the same database. Each relation gets
        one because a connection serves a single result at a time: query a
        connection while a relation of its own is still streaming and that stream
        quietly stops early -- no error, just short (147k rows came back as 1k in
        one measurement). On separate cursors one manager's table can be read
        while another's is still in flight.

        What it costs is joining: DuckDB refuses to combine relations from
        different cursors, so a SQL-level join across two manager tables has to go
        through :attr:`OCEL.con` itself. Joining their :attr:`pl` LazyFrames is
        unaffected -- those come away through Arrow.

        A cursor also has its own session state, so it does not inherit the
        connection's ``TimeZone`` but starts on the machine's own. Left alone it
        would render every ``TIMESTAMPTZ`` in local time, making the tables' dtype
        depend on where the code runs, so the zone is pinned back to UTC here.

        Bind caller-supplied values through ``params`` (``?`` placeholders) rather
        than formatting them into ``sql``, so they stay injection-safe.
        """
        cursor = self._ocel.con.cursor()
        cursor.execute("SET TimeZone='UTC'")
        return cursor.sql(sql, params=params) if params else cursor.sql(sql)

    def _column(self, sql: str, params: list[object] | None = None) -> list[Any]:
        """The first column of ``sql``'s result, as a list.

        For the many summaries that are one column of a handful of rows -- type
        names, qualifiers -- where a frame would be a detour.
        """
        return [row[0] for row in self._relation(sql, params).fetchall()]

    def _attribute_names(self, table: str) -> list[str]:
        """The attribute columns of a stored table: its columns minus the OCEL ones.

        A table's columns *are* the answer -- ``events`` has one per attribute, as
        does ``objects``, and ``object_changes`` keeps only the ones that change --
        so this reads no rows.
        """
        return sorted(
            name
            for name, *_ in self._ocel.con.execute(f"DESCRIBE {ident(table)}").fetchall()
            if not name.startswith("ocel:")
        )

    @contextmanager
    def _bound(self, contents: Any) -> Iterator[str]:
        """Bind ``contents`` to the OCEL's connection for one query, as a view.

        Yields the view's name to select from, and drops it afterwards -- so a
        failed query never leaves the view pinning the caller's frame in memory.

        Anything DuckDB can scan will do: a pandas or polars frame, a LazyFrame,
        an Arrow table. A relation is the exception -- it belongs to the cursor
        that produced it, which this connection cannot read, so it is pulled into
        Arrow first. That also settles its rows *before* the query runs, which is
        what makes replacing a table with something derived from itself
        (``ocel.o2o.table = ocel.o2o.table.limit(7)``) safe.
        """
        con = self._ocel.con
        if isinstance(contents, duckdb.DuckDBPyRelation):
            contents = contents.to_arrow_table()
        con.register(_INCOMING, contents)
        try:
            yield _INCOMING
        finally:
            con.unregister(_INCOMING)

    def _replace(self, table: str, contents: Any, projection: str = "*") -> None:
        """Replace stored ``table`` with ``contents``, projected through ``projection``.

        ``projection`` is the SELECT list that maps the incoming table back onto
        the stored layout, for the tables whose read shape is derived rather than
        stored verbatim.
        """
        with self._bound(contents) as incoming:
            self._ocel.con.execute(
                f'CREATE OR REPLACE TABLE "{table}" AS SELECT {projection} FROM {incoming}'
            )
