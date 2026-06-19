from __future__ import annotations

from typing import cast

import pandas as pd
import polars as pl

from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, EID_COL, TIMESTAMP_COL
from ocelescope.ocel.managers.base import BaseManager
from ocelescope.util.cache import instance_lru_cache


class EventsManager(BaseManager):
    """
    Manages event-level information within an OCEL instance.

    Provides access to:
    - the events table
    - event activities and activity counts
    - activity lookup by event ID
    - event attribute names
    - structured summaries of event attributes

    Stores the events table internally as a polars DataFrame, exposing
    pandas-compatible accessors as a facade.
    """

    def __init__(self, ocel, events_df: pl.DataFrame | None = None):
        """
        Args:
            ocel: The owning OCEL instance.
            events_df: Initial events table. Defaults to an empty table.
        """
        super().__init__(ocel)

        self._events_df = (
            events_df
            if events_df is not None
            else pl.DataFrame(
                schema={EID_COL: pl.String, ACTIVITY_COL: pl.String, TIMESTAMP_COL: pl.Datetime}
            )
        )

    @property
    def df(self) -> pd.DataFrame:
        """
        Return the events table as a pandas DataFrame, converted from the
        internal polars representation.

        Returns:
            DataFrame: A pandas DataFrame containing all events and their attributes.
        """
        return self._events_df.to_pandas()

    @df.setter
    def df(self, value: pd.DataFrame) -> None:
        """Replace the events table, converting it back to polars internally."""
        self._events_df = pl.from_pandas(value)
        self.cache.clear()

    @property
    def pl(self) -> pl.DataFrame:
        """Return the events table as a polars DataFrame (the internal representation)."""
        return self._events_df

    @property
    @instance_lru_cache()
    def activities(self) -> list[str]:
        """
        Return all activity names present in the log.

        Returns:
            list[str]: A sorted list of unique activity names.
        """
        return list(sorted(self.df[ACTIVITY_COL].unique().tolist()))

    @property
    @instance_lru_cache()
    def activity_counts(self) -> pd.Series:
        """
        Return the frequency of each activity in the log.

        Returns:
            Series: A pandas Series indexed by activity name with occurrence counts.
        """
        return self.df[ACTIVITY_COL].value_counts()

    @property
    @instance_lru_cache()
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

    @property
    @instance_lru_cache()
    def attribute_summary(self) -> pd.DataFrame:
        """Return an attribute summary for events, grouped by activity.

        RETURNS:
            A pandas DataFrame indexed by (ATTRIBUTE_COL, ACTIVITY_COL) containing
            the summary statistics produced by `get_summary`.
        """

        return self._ocel.attributes.get_activity_summary()

    def get_event_timestamp(self, event_id: str):
        """
        Returns the timestamp of the passed event.
        """
        return str(self.df.loc[self.df[EID_COL].eq(event_id), TIMESTAMP_COL].iloc[0])
