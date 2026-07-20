from __future__ import annotations

from typing import Any, cast

import duckdb
import pandas as pd
import polars

from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, EID_COL, TIMESTAMP_COL
from ocelescope.ocel.constants.tables import EVENTS_TABLE
from ocelescope.ocel.managers.base import BaseManager


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
        return self._relation(f'SELECT * FROM {EVENTS_TABLE} ORDER BY "{TIMESTAMP_COL}"')

    @table.setter
    def table(self, contents: Any) -> None:
        self._replace(EVENTS_TABLE, contents)

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
        self._replace(EVENTS_TABLE, contents)

    @property
    def pl(self) -> polars.LazyFrame:
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
    def pl(self, contents: polars.LazyFrame | polars.DataFrame) -> None:
        self._replace(EVENTS_TABLE, contents)

    @property
    def activities(self) -> list[str]:
        """
        Return all activity names present in the log.

        Returns:
            list[str]: A sorted list of unique activity names.
        """
        return self._column(f'SELECT DISTINCT "{ACTIVITY_COL}" FROM {EVENTS_TABLE} ORDER BY 1')

    @property
    def activity_counts(self) -> pd.Series:
        """
        Return the frequency of each activity in the log.

        Counted by DuckDB, so only one row per activity is read rather than the
        whole event table. Ordered like ``value_counts``: most frequent first,
        ties broken by name.

        Returns:
            Series: A pandas Series indexed by activity name with occurrence counts.
        """
        counts = self._relation(
            f'SELECT "{ACTIVITY_COL}", count(*) AS "count" FROM {EVENTS_TABLE} '
            f'GROUP BY 1 ORDER BY "count" DESC, 1'
        ).df()
        return cast(pd.Series, counts.set_index(ACTIVITY_COL)["count"])

    @property
    def activity_by_id(self) -> pd.Series:
        """
        Return a mapping from event ID to activity.

        Returns:
            Series: A pandas Series indexed by event ID, containing activity names as values.
        """
        mapping = self._relation(
            f'SELECT "{EID_COL}", "{ACTIVITY_COL}" FROM {EVENTS_TABLE} ORDER BY "{TIMESTAMP_COL}"'
        ).df()
        return cast(pd.Series, mapping.set_index(EID_COL)[ACTIVITY_COL])

    @property
    def attribute_names(self) -> list[str]:
        """
        Return the names of all event attributes.

        Returns:
            list[str]: A sorted list of event attribute names.
        """
        return self._attribute_names(EVENTS_TABLE)

    def get_event_timestamp(self, event_id: str):
        """
        Returns the timestamp of the passed event.
        """
        return str(
            self._relation(
                f'SELECT "{TIMESTAMP_COL}" FROM {EVENTS_TABLE} WHERE "{EID_COL}" = ?', [event_id]
            )
            .df()[TIMESTAMP_COL]
            .iloc[0]
        )
