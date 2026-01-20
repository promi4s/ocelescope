from typing import TYPE_CHECKING

import pandas as pd

from ocelescope.ocel.constants.pm4py import (
    E2O_ACTIVITY,
    E2O_EVENT_ID,
    E2O_OBJECT_ID,
    E2O_OBJECT_TYPE,
)
from ocelescope.ocel.managers.base import BaseManager
from ocelescope.ocel.models.relations import RelationCountSummary
from ocelescope.ocel.util.relations import SUMMARY_DIRECTION, summarize_e2o_counts
from ocelescope.util.cache import instance_lru_cache

if TYPE_CHECKING:
    from ocelescope.ocel.core.ocel import OCEL


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

    def __init__(self, ocel: "OCEL"):
        super().__init__()
        self._ocel = ocel

    # ---------------------------------------------------------
    # Raw → Normalized E2O DataFrame
    # ---------------------------------------------------------
    @property
    def df(self) -> pd.DataFrame:
        """
        Return the E2O relation table with normalized column names.

        PM4PY uses the following columns:
            - "ocel:eid"
            - "ocel:oid"
            - "ocel:type"
            - "ocel:qualifier"

        This property renames them to canonical constants:
            - E2O_EVENT_ID
            - E2O_OBJECT_ID
            - E2O_OBJECT_TYPE

        Returns:
            DataFrame: Normalized E2O relation table.
        """
        raw = self._ocel.ocel.relations

        return raw.rename(
            columns={
                "ocel:eid": E2O_EVENT_ID,
                "ocel:oid": E2O_OBJECT_ID,
                "ocel:type": E2O_OBJECT_TYPE,
                "ocel:activity": E2O_ACTIVITY,
            }
        )

    # ---------------------------------------------------------
    # Typed / Enriched E2O Table
    # ---------------------------------------------------------
    @property
    @instance_lru_cache()
    def typed_df(self) -> pd.DataFrame:
        """
        Return the E2O relation table enriched with:
            - Event activity (from EventsManager)
            - Object type (from ObjectsManager)

        Columns added:
            - E2O_ACTIVITY
            - E2O_OBJECT_TYPE

        Returns:
            DataFrame: Type- and activity-enriched E2O table.
        """
        df = self.df.copy()

        # Join activity (via EventsManager)
        activity_by_id = self._ocel.events.activity_by_id
        df = df.join(activity_by_id.rename(E2O_ACTIVITY), on=E2O_EVENT_ID)

        # Join object type (via ObjectsManager)
        type_by_id = self._ocel.objects.type_by_id
        df = df.join(type_by_id.rename(E2O_OBJECT_TYPE), on=E2O_OBJECT_ID)

        return df

    # ---------------------------------------------------------
    # Summary
    # ---------------------------------------------------------
    @instance_lru_cache()
    def summary(self, direction: SUMMARY_DIRECTION = "source") -> list[RelationCountSummary]:
        """
        Compute summary statistics for E2O relationships.

        Summaries include min/max/total numbers of objects per event
        or events per object, depending on relation direction.

        Uses the shared utility `summarize_e2o_counts`.

        Args:
            direction (SUMMARY_DIRECTION, optional):
                Whether the summary should be computed from the perspective
                of the source object (``"source"``) or the target object
                (``"target"``). Defaults to ``"source"``.


        Returns:
            list[RelationCountSummary]:
                A list of structured summaries of E2O relations.
        """
        return summarize_e2o_counts(self._ocel.ocel, direction)
