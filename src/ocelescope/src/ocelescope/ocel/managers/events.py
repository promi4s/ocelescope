from __future__ import annotations

from typing import Any, cast

import duckdb
import pandas as pd
import polars as pl

from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, EID_COL, TIMESTAMP_COL
from ocelescope.ocel.managers.base import BaseManager

TABLE = "events"


class EventsManager(BaseManager):
    """
    Manages event-level information within an OCEL instance.

    Provides access to:
    - the events table
    - event activities and activity counts
    - activity lookup by event ID
    - event attribute names
    - structured summaries of event attributes

    The events are stored in exactly the shape they are read in, so reading only
    pins their order and assigning one back is a straight replace.
    """

    @property
    def table(self) -> duckdb.DuckDBPyRelation:
        """
        Return the event table as a lazy DuckDB relation, in timestamp order.

        Nothing is read until the relation is consumed (``.df()``, ``.pl()``,
        ``.fetchall()`` ...), so this is the cheapest way to reach the events.

        Returns:
            DuckDBPyRelation: A lazy relation over all events.
        """
        return self._relation(f'SELECT * FROM {TABLE} ORDER BY "{TIMESTAMP_COL}"')

    @table.setter
    def table(self, contents: Any) -> None:
        self._replace(TABLE, contents)

    @property
    def df(self) -> pd.DataFrame:
        """
        Return the event table from the underlying OCEL.

        Read from the OCEL's DuckDB database on every access.

        Returns:
            DataFrame: A pandas DataFrame containing all events and their attributes.
        """
        return self.table.df()

    @df.setter
    def df(self, contents: pd.DataFrame) -> None:
        self._replace(TABLE, contents)

    @property
    def pl(self) -> pl.LazyFrame:
        """
        Return the event table as a polars LazyFrame.

        Nothing is read until it is collected, so further filtering or projection
        can be pushed down rather than paid for here.

        Each access is its own scan, bound to its own cursor -- so read it freshly
        at each use rather than storing it in a variable and reusing it. One
        LazyFrame cannot be read twice within a single query.

        Returns:
            polars.LazyFrame: All events and their attributes.
        """
        return self.table.pl(lazy=True)

    @pl.setter
    def pl(self, contents: pl.LazyFrame | pl.DataFrame) -> None:
        self._replace(TABLE, contents)

    @property
    def activities(self) -> list[str]:
        """
        Return all activity names present in the log.

        Returns:
            list[str]: A sorted list of unique activity names.
        """
        return list(sorted(self.df[ACTIVITY_COL].unique().tolist()))

    @property
    def activity_counts(self) -> pd.Series:
        """
        Return the frequency of each activity in the log.

        Returns:
            Series: A pandas Series indexed by activity name with occurrence counts.
        """
        return self.df[ACTIVITY_COL].value_counts()

    @property
    def activity_by_id(self) -> pd.Series:
        """
        Return a mapping from event ID to activity.

        Returns:
            Series: A pandas Series indexed by event ID, containing activity names as values.
        """
        return cast(pd.Series, self.df[[EID_COL, ACTIVITY_COL]].set_index(EID_COL)[ACTIVITY_COL])

    @property
    def attribute_names(self) -> list[str]:
        """
        Return the names of all event attributes.

        Returns:
            list[str]: A sorted list of event attribute names.
        """
        return sorted([col for col in self.df.columns if not col.startswith("ocel:")])

    def get_event_timestamp(self, event_id: str):
        """
        Returns the timestamp of the passed event.
        """
        return str(self.df.loc[self.df[EID_COL].eq(event_id), TIMESTAMP_COL].iloc[0])
