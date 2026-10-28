from __future__ import annotations

from abc import ABC, abstractmethod
from itertools import count
from typing import Any

from duckdb import DuckDBPyConnection, DuckDBPyRelation

from ocelescope.ocel.constants.pm4py import EID_COL, OID_COL
from ocelescope.ocel.constants.tables import EVENTS_TABLE, OBJECTS_TABLE
from ocelescope.util.sql import ident

_ID_COLUMNS = {EVENTS_TABLE: EID_COL, OBJECTS_TABLE: OID_COL}


class Step:
    """The OCEL's tables as the step before this one left them.

    Each table is a relation the operation reads from: the stored table, or one
    an earlier step made. An operation sets a table with ``step[table] = query``,
    a view, so the log itself is never written to or copied; the tables are the
    log's, none is added or dropped. Everything a step creates lives in its
    view's catalog and goes with it.

    A query naming more than one ``step[...]`` should be stored with
    :meth:`materialize`: views reading several views that read several views
    multiply with every step, where a view reading one grows only by one.
    """

    def __init__(
        self,
        con: DuckDBPyConnection,
        schema: str,
        index: int,
        tables: dict[str, str],
        created: list[tuple[str, str | None]],
    ):
        self._con = con
        self._created = created
        self._schema = schema
        self._index = index
        self._names = count()
        self.tables = dict(tables)

    def __getitem__(self, table: str) -> str:
        """The relation ``table`` reads from as of this step, quoted for SQL."""
        return self.tables[table]

    def __setitem__(self, table: str, query: str) -> None:
        if table not in self.tables:
            raise KeyError(table)
        view = self._name(table)
        self._create_view(view, query)
        self.tables[table] = view

    def _name(self, name: str) -> str:
        return f"{self._schema}.{ident(f'{self._index}_{next(self._names)}_{name}')}"

    def sql(self, query: str) -> DuckDBPyRelation:
        return self._con.sql(query)

    def keep(self, table: str, ids: str) -> None:
        """Keep only the events or objects whose id ``ids`` selects.

        ``ids`` is a query selecting ids under the table's id column. The ones
        still in the table are stored, then the table is set to its rows with
        them -- stored so a query reading the table it narrows is run once.
        Nothing is cleaned; that is :class:`Clean`'s.
        """
        id_col = ident(_ID_COLUMNS[table])
        kept = self.materialize(
            f"kept_{table}",
            f"SELECT {id_col} FROM {self[table]} "
            f"WHERE {id_col} IN (SELECT {id_col} FROM ({ids}))",
        )
        self[table] = (
            f"SELECT * FROM {self[table]} "
            f"WHERE {id_col} IN (SELECT {id_col} FROM {kept})"
        )

    def materialize(self, name: str, query: str) -> str:
        """Store ``query``'s result as a table, giving the relation to read it from.

        For what is small but read often, like a set of ids: a view would be
        recomputed by every query reading it, and stacking views that read their
        predecessor more than once grows each query with the number of steps.
        """
        table = self._name(name)
        self._con.execute(f"CREATE TABLE {table} AS {query}")
        self._created.append((table, None))
        return table

    def _create_view(self, view: str, query: str) -> None:
        self._con.execute(f"CREATE VIEW {view} AS {query}")
        self._created.append((view, query))

    def load(self, name: str, data: Any) -> str:
        """Store ``data`` -- anything DuckDB can scan, like Arrow -- as a table."""
        incoming = f"_incoming_{self._index}"
        self._con.register(incoming, data)
        try:
            return self.materialize(name, f"FROM {incoming}")
        finally:
            self._con.unregister(incoming)


class ViewOperation(ABC):
    """One step of an :class:`OCELView`: it sets the tables it changes the log by."""

    @abstractmethod
    def build(self, step: Step) -> None:
        """Set, on ``step``, the tables this operation changes the log by."""
