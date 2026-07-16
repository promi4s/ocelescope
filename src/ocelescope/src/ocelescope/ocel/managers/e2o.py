from __future__ import annotations

from typing import Any

import duckdb
import pandas as pd
import polars as pl

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
from ocelescope.ocel.managers.base import BaseManager

TABLE = "e2o"
_EVENTS_TABLE = "events"
_OBJECTS_TABLE = "objects"


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
            f"FROM {TABLE} r "
            f'JOIN {_EVENTS_TABLE} e ON r."{EID_COL}" = e."{EID_COL}" '
            f'JOIN {_OBJECTS_TABLE} o ON r."{OID_COL}" = o."{OID_COL}" '
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
    def pl(self) -> pl.LazyFrame:
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
    def pl(self, contents: pl.LazyFrame | pl.DataFrame) -> None:
        self._store(contents)

    def _store(self, contents: Any) -> None:
        """Store ``contents`` as the E2O relations, dropping the derived columns."""
        projection = ", ".join(f'"{c}"' for c in (E2O_EVENT_ID, E2O_QUALIFIER, E2O_OBJECT_ID))
        self._replace(TABLE, contents, projection)

    @property
    def qualifiers(self) -> list[str]:
        """
        Return the list of all qualifiers present in the E2O relations.

        Returns:
            list[str]: Sorted list of unique qualifier names.
        """
        return sorted(self.df[E2O_QUALIFIER].dropna().unique().tolist())

    def get_events_of_object(self, object_id: str):
        return self.df.loc[self.df[OID_COL].eq(object_id), EID_COL].dropna().unique()

    def __get_event_timestamps_of_object(self, object_id: str):
        events = self._ocel.events.df

        return events.loc[
            events[EID_COL].isin(self.get_events_of_object(object_id)), [EID_COL, TIMESTAMP_COL]
        ].set_index(EID_COL)[TIMESTAMP_COL]

    def get_first_event_of_object(self, object_id: str) -> str | None:
        return str(
            self.__get_event_timestamps_of_object(
                object_id,
            ).idxmin()
        )

    def get_last_event_of_object(self, object_id: str) -> str | None:
        return str(
            self.__get_event_timestamps_of_object(
                object_id,
            ).idxmax()
        )
