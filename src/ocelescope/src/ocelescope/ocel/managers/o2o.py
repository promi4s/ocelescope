from typing import TYPE_CHECKING

import pandas as pd

from ocelescope.ocel.constants.pm4py import (
    O2O_SOURCE_ID,
    O2O_SOURCE_TYPE,
    O2O_TARGET_ID,
    O2O_TARGET_TYPE,
)
from ocelescope.ocel.managers.base import BaseManager
from ocelescope.ocel.models.relations import RelationCountSummary
from ocelescope.ocel.util.relations import SUMMARY_DIRECTION, summarize_o2o_counts
from ocelescope.util.cache import instance_lru_cache

if TYPE_CHECKING:
    from ocelescope.ocel.core.ocel import OCEL


class O2OManager(BaseManager):
    """
    Manages object-to-object (O2O) relations within an OCEL instance.

    Provides:
        - Access to the raw O2O relation table
        - A normalized O2O table using canonical constant column names
        - Type-enriched O2O relations (joining object types)
        - Aggregated summaries of O2O relation multiplicities

    This manager acts as a typed and normalized facade over the
    PM4PY O2O relation table.
    """

    def __init__(self, ocel: "OCEL"):
        super().__init__()
        self._ocel = ocel

    @property
    def df(self) -> pd.DataFrame:
        """
        Return the O2O relation table with normalized column names.

        PM4PY uses mixed naming conventions for O2O relations
        (e.g., "ocel:oid" and "ocel:oid_2").
        This property maps these raw names to canonical constants:

            - O2O_SOURCE_ID
            - O2O_TARGET_ID

        Returns:
            DataFrame: A normalized O2O relation table.
        """
        raw = self._ocel.ocel.o2o

        return raw.rename(
            columns={
                "ocel:oid": O2O_SOURCE_ID,
                "ocel:oid_2": O2O_TARGET_ID,
            }
        )

    @property
    @instance_lru_cache()
    def typed_df(self) -> pd.DataFrame:
        """
        Return the O2O relation table enriched with object types.

        Adds two additional columns to the normalized O2O table:

            - O2O_SOURCE_TYPE
            - O2O_TARGET_TYPE

        These are obtained by joining against the object manager’s
        `type_by_id` Series.

        Returns:
            DataFrame: A type-enriched O2O relation table.
        """
        type_by_id: pd.Series = self._ocel.objects.type_by_id

        df = self.df.copy()

        df = df.join(type_by_id.rename(O2O_SOURCE_TYPE), on=O2O_SOURCE_ID)
        df = df.join(type_by_id.rename(O2O_TARGET_TYPE), on=O2O_TARGET_ID)

        return df

    @instance_lru_cache()
    def summary(self, direction: SUMMARY_DIRECTION = "source") -> list[RelationCountSummary]:
        """
        Compute summary statistics for O2O relationships.

        Summaries include min/max/total numbers of target objects
        per source object, grouped by qualifier and type.

        Args:
            direction (SUMMARY_DIRECTION, optional):
                Whether the summary should be computed from the perspective
                of the source object (``"source"``) or the target object
                (``"target"``). Defaults to ``"source"``.

        Returns:
            list[RelationCountSummary]:
                A list of structured relation count summaries.
        """
        return summarize_o2o_counts(self._ocel.ocel, direction)
