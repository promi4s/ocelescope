"""An OCEL changed step by step through views, without writing to the log.

Each operation's views read the ones before.

A view's steps live in a catalog of its own, a database attached for the purpose
-- in memory, or at a path given -- either:

* next to the log's own database, when that can be written to -- an in-memory
  log, or a file opened for writing;
* on a connection of the view's own, which attaches the log's file read-only,
  when the log is read-only -- DuckDB will not attach anything to a read-only
  database, not even an in-memory one.

The tables, under their own names, are published in the catalog's ``main``, or,
on a connection of the view's own, in that connection's default database -- where
an :class:`OCEL` over it looks for them, see :meth:`OCELView.ocel`.
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
_SAVED = "ocel_view_saved"
_TARGET = "ocel_view_target"


class OCELView:
    """``ocel`` as a stack of operations leaves it.

    Operations are applied in order with :meth:`apply`; the log as they leave it
    is queried with :meth:`sql`. What they create lives until :meth:`close`, in
    memory or, given ``path``, in a DuckDB file there, replacing any.
    """

    def __init__(self, ocel: OCEL, path: str | Path | None = None):
        catalog, schema, read_only, source_path = ocel.con.execute(
            "SELECT database_name, current_schema(), readonly, path "
            "FROM duckdb_databases() WHERE database_name = current_database()"
        ).fetchall()[0]

        if path is not None:
            Path(path).unlink(missing_ok=True)
        self._catalog = ident(f"ocel_view_{uuid4().hex[:12]}")
        self._source_path: str | None = source_path if read_only else None
        self._created: list[tuple[str, str | None]] = []

        if read_only:
            self._con = duckdb.connect(":memory:")
            source = _SOURCE
        else:
            self._con = ocel.con.cursor()
            source = catalog

        try:
            set_utc(self._con)
            if read_only:
                default = self._con.execute("SELECT current_database()").fetchall()
                self._main = f"{ident(default[0][0])}.main"
            else:
                self._main = f"{self._catalog}.main"
            if read_only:
                self._con.execute(
                    f"ATTACH {literal(source_path)} AS {ident(source)} (READ_ONLY)"
                )
            target = ":memory:" if path is None else str(path)
            self._con.execute(f"ATTACH {literal(target)} AS {self._catalog}")
            self._con.execute(f"CREATE SCHEMA {self._catalog}.steps")

            names = self._con.execute(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_catalog = ? AND table_schema = ?",
                [source, schema],
            ).fetchall()
            stored = f"{ident(source)}.{ident(schema)}"
            self._tables = {name: f"{stored}.{ident(name)}" for (name,) in names}
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
                self._created,
            )
            operation.build(step)
            self._tables = step.tables
        self._publish()
        return self

    def _publish(self) -> None:
        """Make this view's tables, under their own names, what they are now."""
        for table, relation in self._tables.items():
            self._con.execute(
                f"CREATE OR REPLACE VIEW {self._main}.{ident(table)} "
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
        cursor.execute(f"USE {self._main}")
        return cursor.sql(query, params=list(params)) if params else cursor.sql(query)

    def ocel(self) -> OCEL:
        from ocelescope.ocel.core import OCEL

        if self._source_path is None:
            raise ValueError("Only a view of a log read from a file is an OCEL")
        cursor = self._con.cursor()
        set_utc(cursor)
        return OCEL(cursor)

    def save(self, path: str | Path) -> None:
        if self._source_path is None:
            raise ValueError("Only a view of a log read from a file can be saved")

        path = Path(path)
        path.unlink(missing_ok=True)
        saved = ident(_SAVED)
        own, renamed = f"{self._catalog}.", f"{saved}."
        self._con.execute(f"ATTACH {literal(str(path))} AS {saved}")
        try:
            self._con.execute(f"CREATE SCHEMA {saved}.steps")
            self._con.execute(f"CREATE SCHEMA {saved}.meta")
            self._con.execute(
                f"CREATE TABLE {saved}.meta.source AS "
                f"SELECT {literal(self._source_path)} AS path"
            )
            for name, query in self._created:
                target = name.replace(own, renamed, 1)
                if query is None:
                    self._con.execute(f"CREATE TABLE {target} AS FROM {name}")
                else:
                    self._con.execute(
                        f"CREATE VIEW {target} AS {query.replace(own, renamed)}"
                    )
            for table, relation in self._tables.items():
                self._con.execute(
                    f"CREATE VIEW {saved}.main.{ident(table)} AS "
                    f"SELECT * FROM {relation.replace(own, renamed, 1)}"
                )
        finally:
            self._con.execute(f"DETACH {saved}")

    @staticmethod
    def load(path: str | Path) -> OCEL:
        from ocelescope.ocel.core import OCEL

        con = duckdb.connect(":memory:")
        try:
            set_utc(con)
            saved = ident(_SAVED)
            con.execute(f"ATTACH {literal(str(path))} AS {saved} (READ_ONLY)")
            row = con.execute(f"SELECT path FROM {saved}.meta.source").fetchone()
            if row is None:
                raise ValueError(f"{path} is not a saved view")
            (source,) = row
            con.execute(f"ATTACH {literal(source)} AS {ident(_SOURCE)} (READ_ONLY)")
            for (table,) in con.execute(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_catalog = ? AND table_schema = 'main'",
                [_SAVED],
            ).fetchall():
                con.execute(
                    f"CREATE VIEW main.{ident(table)} AS "
                    f"SELECT * FROM {saved}.main.{ident(table)}"
                )
        except Exception:
            con.close()
            raise
        return OCEL(con)

    @staticmethod
    def materialize(saved: str | Path, path: str | Path) -> None:
        path = Path(path)
        path.unlink(missing_ok=True)
        target = ident(_TARGET)
        with OCELView.load(saved) as ocel:
            tables = ocel.con.execute(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_catalog = current_database() AND table_schema = 'main'"
            ).fetchall()
            ocel.con.execute(f"ATTACH {literal(str(path))} AS {target}")
            try:
                for (table,) in tables:
                    ocel.con.execute(
                        f"CREATE TABLE {target}.main.{ident(table)} "
                        f"AS FROM main.{ident(table)}"
                    )
            finally:
                ocel.con.execute(f"DETACH {target}")

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
