"""An OCEL changed step by step through views, without copying it.

A view's steps live in a catalog of its own, an in-memory database attached for
the purpose:

* next to the log's own database, when that can be written to -- an in-memory
  log, or a file opened for writing;
* on a connection of the view's own, which attaches the log's file read-only,
  when the log is read-only -- DuckDB will not attach anything to a read-only
  database, not even an in-memory one.

Nothing is computed until the view is queried with :meth:`OCELView.sql` or
written out, by :meth:`OCELView.to_ocel` or :meth:`OCELView.to_duckdb`.
"""

from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path
from typing import TYPE_CHECKING, Self
from uuid import uuid4

import duckdb

from ocelescope.ocel.view.step import Step, ViewOperation
from ocelescope.util.sql import ident, literal, set_utc

if TYPE_CHECKING:
    from ocelescope.ocel.core import OCEL

_SOURCE = "ocel_view_source"
_TARGET = "ocel_view_target"


class OCELView:
    """``ocel`` as a stack of operations leaves it, each defining views.

    Operations are applied in order with :meth:`apply`; the log as they leave it
    is queried with :meth:`sql`. The views live until :meth:`close`.
    """

    def __init__(self, ocel: OCEL):
        catalog, schema, read_only, path = ocel.con.execute(
            "SELECT database_name, current_schema(), readonly, path "
            "FROM duckdb_databases() WHERE database_name = current_database()"
        ).fetchall()[0]

        self._catalog = ident(f"ocel_view_{uuid4().hex[:12]}")
        if read_only:
            self._con = duckdb.connect(":memory:")
            source = _SOURCE
        else:
            self._con = ocel.con.cursor()
            source = catalog

        try:
            set_utc(self._con)
            if read_only:
                self._con.execute(
                    f"ATTACH {literal(path)} AS {ident(source)} (READ_ONLY)"
                )
            self._con.execute(f"ATTACH ':memory:' AS {self._catalog}")
            self._con.execute(f"CREATE SCHEMA {self._catalog}.steps")

            names = self._con.execute(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_catalog = ? AND table_schema = ?",
                [source, schema],
            ).fetchall()
            stored = f"{ident(source)}.{ident(schema)}"
            self._tables = {name: f"{stored}.{ident(name)}" for (name,) in names}
            self._bases = dict(self._tables)
            self._steps = 0
            self._publish()
        except Exception:
            self._con.close()
            raise

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *_exc) -> None:
        self.close()

    def close(self) -> None:
        """Drop the views."""
        try:
            self._con.execute(f"DETACH {self._catalog}")
        finally:
            self._con.close()

    @property
    def tables(self) -> dict[str, str]:
        """Each table's relation as of the last step, quoted for SQL."""
        return dict(self._tables)

    def apply(self, *operations: ViewOperation) -> Self:
        """Apply ``operations`` in order, each as a step of its own."""
        for operation in operations:
            self._steps += 1
            step = Step(
                self._con,
                f"{self._catalog}.steps",
                self._steps,
                self._tables,
                self._bases,
            )
            operation.build(step)
            self._tables, self._bases = step.tables, step.bases
        self._publish()
        return self

    def _publish(self) -> None:
        """Make this view's tables, under their own names, what they are now."""
        for table, relation in self._tables.items():
            self._con.execute(
                f"CREATE OR REPLACE VIEW {self._catalog}.main.{ident(table)} "
                f"AS SELECT * FROM {relation}"
            )

    def sql(
        self, query: str, params: Sequence[object] | None = None
    ) -> duckdb.DuckDBPyRelation:
        """Run a read query over the log, with the tables under their own names.

        Like :meth:`OCEL.sql`, on a cursor of its own, so results can be combined.
        """
        cursor = self._con.cursor()
        set_utc(cursor)
        cursor.execute(f"USE {self._catalog}.main")
        return cursor.sql(query, params=list(params)) if params else cursor.sql(query)

    def to_duckdb(self, path: str | Path) -> None:
        """Write the log into a DuckDB file at ``path``, replacing any there.

        Each table is one ``CREATE TABLE ... AS``, so DuckDB computes and writes
        it without the log passing through Python.
        """
        path = Path(path)
        path.unlink(missing_ok=True)
        target = ident(f"{_TARGET}_{uuid4().hex[:12]}")
        self._con.execute(f"ATTACH {literal(str(path))} AS {target}")
        try:
            for table, relation in self.tables.items():
                self._con.execute(
                    f"CREATE TABLE {target}.main.{ident(table)} AS FROM {relation}"
                )
        finally:
            self._con.execute(f"DETACH {target}")

    def to_ocel(self) -> OCEL:
        """The log as a new, in-memory :class:`OCEL` of its own.

        Each table crosses as one Arrow table: a batch reader is drained on a
        single thread, which makes a large log's copy several times slower.
        """
        from ocelescope.ocel.core import OCEL

        con = duckdb.connect(":memory:")
        try:
            set_utc(con)
            for table, relation in self.tables.items():
                con.from_arrow(
                    self._con.sql(f"FROM {relation}").to_arrow_table()
                ).create(table)
        except Exception:
            con.close()
            raise
        return OCEL(con)
