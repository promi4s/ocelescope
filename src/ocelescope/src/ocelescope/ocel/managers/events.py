from typing import TYPE_CHECKING, cast

import pandas as pd

from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, EID_COL
from ocelescope.ocel.managers.base import BaseManager
from ocelescope.ocel.managers.objects import AttributeSummary
from ocelescope.ocel.util.attributes import summarize_event_attributes
from ocelescope.util.cache import instance_lru_cache

if TYPE_CHECKING:
    from ocelescope.ocel.core.ocel import OCEL


class EventsManager(BaseManager):
    """
    Manages event-level information within an OCEL instance.

    Provides access to:
    - the events table
    - event activities and activity counts
    - activity lookup by event ID
    - event attribute names
    - structured summaries of event attributes

    Acts as a facade over the underlying PM4PY OCEL object.
    """

    def __init__(self, ocel: "OCEL"):
        super().__init__()
        self._ocel = ocel

    @property
    def df(self) -> pd.DataFrame:
        """
        Return the event table from the underlying OCEL.

        Returns:
            DataFrame: A pandas DataFrame containing all events and their attributes.
        """
        return self._ocel.ocel.events

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
    def attribute_summary(self) -> dict[str, list[AttributeSummary]]:
        """
        Summarize all event attributes grouped by activity.

        Returns:
            dict[str, list[AttributeSummary]]: Mapping of activities to
            lists of structured attribute summaries.
        """
        return summarize_event_attributes(self._ocel.ocel)
