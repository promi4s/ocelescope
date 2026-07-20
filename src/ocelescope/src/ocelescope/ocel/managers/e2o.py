from __future__ import annotations

from typing import Any

import duckdb
import pandas as pd
import polars

from ocelescope.ocel.constants.pm4py import (
    E2O_ACTIVITY,
    E2O_EVENT_ID,
    E2O_OBJECT_ID,
    E2O_OBJECT_TYPE,
    E2O_QUALIFIER,
    EID_COL,
    OID_COL,
    TIMESTAMP_COL,
)
from ocelescope.ocel.constants.tables import E2O_TABLE, EVENTS_TABLE, OBJECTS_TABLE
from ocelescope.ocel.managers.base import BaseManager


class E2OManager(BaseManager):
    """
    Manages event-to-object (E2O) relations within an OCEL instance.

    Provides:
        - Access to the raw E2O relation table
        - A normalized E2O table using canonical column names
        - Enriched E2O table including activity and object type information
        - Aggregated multiplicity summaries for E2O relations

    This manager acts as a typed and normalized façade over the
    PM4PY E2O relations.
    """

    # ---------------------------------------------------------
    # Raw → Normalized E2O DataFrame
    # ---------------------------------------------------------
    @property
    def table(self) -> duckdb.DuckDBPyRelation:
        """
        Return the E2O relation table as a lazy DuckDB relation.

        The stored relations are joined to their event (activity, timestamp) and
        to their object's type. Those three columns are derived here rather than
        stored, so assigning this table back drops them again.

        The canonical E2O column names (``E2O_EVENT_ID`` and friends) are the
        same strings PM4PY uses, so this shape serves both.

        Returns:
            DuckDBPyRelation: A lazy relation over all E2O relations.
        """
        return self._relation(
            f'SELECT r."{E2O_EVENT_ID}", r."{E2O_OBJECT_ID}", r."{E2O_QUALIFIER}", '
            f'e."{E2O_ACTIVITY}", e."{TIMESTAMP_COL}", o."{E2O_OBJECT_TYPE}" '
            f"FROM {E2O_TABLE} r "
            f'JOIN {EVENTS_TABLE} e ON r."{EID_COL}" = e."{EID_COL}" '
            f'JOIN {OBJECTS_TABLE} o ON r."{OID_COL}" = o."{OID_COL}" '
            f'ORDER BY e."{TIMESTAMP_COL}"'
        )

    @table.setter
    def table(self, contents: Any) -> None:
        self._store(contents)

    @property
    def df(self) -> pd.DataFrame:
        """
        Return the E2O relation table.

        Read from the OCEL's DuckDB database on every access. Columns follow the
        canonical constants (E2O_EVENT_ID, E2O_OBJECT_ID, E2O_OBJECT_TYPE,
        E2O_ACTIVITY, E2O_QUALIFIER), which PM4PY happens to share.

        Returns:
            DataFrame: E2O relation table.
        """
        return self.table.df()

    @df.setter
    def df(self, contents: pd.DataFrame) -> None:
        self._store(contents)

    @property
    def pl(self) -> polars.LazyFrame:
        """
        Return the E2O relation table as a polars LazyFrame.

        Nothing is read until it is collected.

        Each access is its own scan, bound to its own cursor -- so read it freshly
        at each use rather than storing it in a variable and reusing it. One
        LazyFrame cannot be read twice within a single query.

        Returns:
            polars.LazyFrame: E2O relation table.
        """
        return self.table.pl(lazy=True)

    @pl.setter
    def pl(self, contents: polars.LazyFrame | polars.DataFrame) -> None:
        self._store(contents)

    def _store(self, contents: Any) -> None:
        """Store ``contents`` as the E2O relations, dropping the derived columns."""
        projection = ", ".join(f'"{c}"' for c in (E2O_EVENT_ID, E2O_QUALIFIER, E2O_OBJECT_ID))
        self._replace(E2O_TABLE, contents, projection)

    @property
    def qualifiers(self) -> list[str]:
        """
        Return the list of all qualifiers present in the E2O relations.

        Returns:
            list[str]: Sorted list of unique qualifier names.
        """
        return self._column(
            f'SELECT DISTINCT "{E2O_QUALIFIER}" FROM {E2O_TABLE} '
            f'WHERE "{E2O_QUALIFIER}" IS NOT NULL ORDER BY 1'
        )

    def get_events_of_object(self, object_id: str):
        """
        Return the ids of the events the given object takes part in, in time order.

        Only the object's own relations are read, not the whole E2O table. Events
        sharing a timestamp are ordered by id, so the order is fully determined.

        Returns:
            numpy.ndarray: The event ids, ordered by event timestamp then by id.
        """
        return (
            self._relation(
                f'SELECT r."{EID_COL}" FROM {E2O_TABLE} r '
                f'JOIN {EVENTS_TABLE} e ON r."{EID_COL}" = e."{EID_COL}" '
                f'WHERE r."{OID_COL}" = ? AND r."{EID_COL}" IS NOT NULL '
                f'GROUP BY r."{EID_COL}" '
                f'ORDER BY min(e."{TIMESTAMP_COL}"), r."{EID_COL}"',
                [object_id],
            )
            .df()[EID_COL]
            .unique()
        )

    def _boundary_event_of_object(self, object_id: str, which: str) -> str | None:
        """The id of the object's earliest (``min``) or latest (``max``) event.

        ``arg_min``/``arg_max`` pick the id belonging to the extreme timestamp in a
        single pass, so no per-event rows are read. An object with no events yields
        one null row rather than nothing, which is why the value -- not the row --
        is what gets checked.
        """
        rows = self._relation(
            f'SELECT arg_{which}(r."{EID_COL}", e."{TIMESTAMP_COL}") FROM {E2O_TABLE} r '
            f'JOIN {EVENTS_TABLE} e ON r."{EID_COL}" = e."{EID_COL}" '
            f'WHERE r."{OID_COL}" = ?',
            [object_id],
        ).fetchall()
        event_id = rows[0][0] if rows else None
        return str(event_id) if event_id is not None else None

    def get_first_event_of_object(self, object_id: str) -> str | None:
        """The id of the object's earliest event, or None if it has none."""
        return self._boundary_event_of_object(object_id, "min")

    def get_last_event_of_object(self, object_id: str) -> str | None:
        """The id of the object's latest event, or None if it has none."""
        return self._boundary_event_of_object(object_id, "max")
