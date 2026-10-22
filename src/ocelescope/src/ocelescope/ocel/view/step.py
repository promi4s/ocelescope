from __future__ import annotations

from abc import ABC, abstractmethod
from itertools import count
from typing import Any

from duckdb import DuckDBPyConnection

from ocelescope.ocel.constants.pm4py import EID_COL, OID_COL
from ocelescope.ocel.constants.tables import EVENTS_TABLE, OBJECTS_TABLE
from ocelescope.util.sql import ident

_ID_COLUMNS = {EVENTS_TABLE: EID_COL, OBJECTS_TABLE: OID_COL}


class Step:
    """The OCEL's tables as the operations before one step leave them.

    Each table is a relation the operation reads from: the stored table, or a
    view an earlier step defined over it. An operation changes a table by
    defining a new view, so the log itself is never written to or copied.
    Everything a step creates lives in its view's catalog and goes with it.

    ``bases`` holds each table as the last :meth:`define` left it, which is what
    :meth:`restrict` narrows -- so however many restrictions follow, a table is
    never more than one view away from its last definition.
    """

    def __init__(
        self,
        con: DuckDBPyConnection,
        schema: str,
        index: int,
        tables: dict[str, str],
        bases: dict[str, str],
    ):
        self._con = con
        self._schema = schema
        self._index = index
        self._names = count()
        self.tables = dict(tables)
        self.bases = dict(bases)

    def __getitem__(self, table: str) -> str:
        """The relation ``table`` reads from as of this step, quoted for SQL."""
        return self.tables[table]

    def _name(self, name: str) -> str:
        return f"{self._schema}.{ident(f'{self._index}_{next(self._names)}_{name}')}"

    def columns(self, table: str) -> list[str]:
        """The columns ``table`` has as of this step."""
        return self._con.sql(f"SELECT * FROM {self[table]} LIMIT 0").columns

    def define(self, table: str, query: str) -> None:
        """Make ``query`` what ``table`` is from here on."""
        view = self._name(table)
        self._con.execute(f"CREATE VIEW {view} AS {query}")
        self.tables[table] = view
        self.bases[table] = view

    def restrict(self, table: str, condition: str) -> None:
        """Keep only the rows of ``table`` that ``condition`` holds for.

        The condition is applied to the table as it was last *defined*, not to
        the restrictions since, so it must hold for none of the rows those have
        already dropped. Ids drawn from the table as it is now -- the way
        :class:`Clean` and filters narrow it -- always satisfy that: they are a
        subset of what is left. Anything else is a :meth:`define`.
        """
        view = self._name(table)
        self._con.execute(
            f"CREATE VIEW {view} AS SELECT * FROM {self.bases[table]} WHERE {condition}"
        )
        self.tables[table] = view

    def keep(self, table: str, ids: str) -> None:
        """Keep only the events or objects whose id ``ids`` selects.

        ``ids`` is a query selecting ids under the table's id column. The ones
        still in the table are stored, then the table is restricted to them --
        stored so a query reading the table it narrows is run once, and drawn
        from the table so the restriction only ever narrows. Nothing is cleaned;
        that is :class:`Clean`'s.
        """
        id_col = ident(_ID_COLUMNS[table])
        kept = self.materialize(
            f"kept_{table}",
            f"SELECT {id_col} FROM {self[table]} "
            f"WHERE {id_col} IN (SELECT {id_col} FROM ({ids}))",
        )
        self.restrict(table, f"{id_col} IN (SELECT {id_col} FROM {kept})")

    def materialize(self, name: str, query: str) -> str:
        """Store ``query``'s result as a table, giving the relation to read it from.

        For what is small but read often, like a set of ids: a view would be
        recomputed by every query reading it, and stacking views that read their
        predecessor more than once grows each query with the number of steps.
        """
        table = self._name(name)
        self._con.execute(f"CREATE TABLE {table} AS {query}")
        return table

    def load(self, name: str, data: Any) -> str:
        """Store ``data`` -- anything DuckDB can scan, like Arrow -- as a table."""
        incoming = f"_incoming_{self._index}"
        self._con.register(incoming, data)
        try:
            return self.materialize(name, f"FROM {incoming}")
        finally:
            self._con.unregister(incoming)


class ViewOperation(ABC):
    """One step of an :class:`OCELView`: it defines the views it changes the log by."""

    @abstractmethod
    def build(self, step: Step) -> None:
        """Define, on ``step``, the views this operation changes the log by."""
