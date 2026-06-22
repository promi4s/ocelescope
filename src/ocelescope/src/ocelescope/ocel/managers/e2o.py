import pandas as pd

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
from ocelescope.ocel.util.relations import (
    SUMMARY_DIRECTION,
    get_relation_combination,
    summarize_relation,
)
from ocelescope.util.cache import instance_lru_cache


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
    # Summary
    # ---------------------------------------------------------
    def summary(
        self,
        direction: SUMMARY_DIRECTION = "source",
        filter_df: pd.DataFrame | None = None,
        with_qualifier: bool = True,
    ) -> pd.DataFrame:
        """
        Compute summary statistics for E2O relationships.

        Summaries include min/max/total numbers of objects per event
        or events per object, depending on relation direction.

        Uses the shared utility `summarize_relation`.

        Args:
            direction (SUMMARY_DIRECTION, optional):
                Whether the summary should be computed from the perspective
                of the source object (``"source"``) or the target object
                (``"target"``). Defaults to ``"source"``.
            filter_df (DataFrame, optional):
                A combination table (as returned by :meth:`combinations`) used to
                restrict the summary to those (source_type, target_type, qualifier)
                combinations. ``None`` means no restriction.
            with_qualifier (bool, optional):
                Whether to break the summary down by qualifier. When ``False`` the
                summary is aggregated per (source_type, target_type) across all
                qualifiers. Defaults to ``True``.


        Returns:
            DataFrame:
                Indexed by (source_type, target_type[, qualifier]) with the
                ``min``, ``max`` and ``sum`` of related items per source instance.
        """
        is_source = direction == "source"

        return summarize_relation(
            relation_table=self.df,
            source_id_field=E2O_EVENT_ID if is_source else E2O_OBJECT_ID,
            target_id_field=E2O_OBJECT_ID if is_source else E2O_EVENT_ID,
            source_type_field=E2O_ACTIVITY if is_source else E2O_OBJECT_TYPE,
            target_type_field=E2O_OBJECT_TYPE if is_source else E2O_ACTIVITY,
            source_type_map=(
                self._ocel.events.activity_by_id if is_source else self._ocel.objects.type_by_id
            ),
            qualifier_field=E2O_QUALIFIER if with_qualifier else None,
            filter_df=filter_df,
        )

    @instance_lru_cache()
    def combinations(
        self,
        direction: SUMMARY_DIRECTION = "source",
        source_types: tuple[str, ...] = (),
        target_types: tuple[str, ...] = (),
        qualifiers: tuple[str, ...] = (),
        with_qualifier: bool = True,
    ) -> pd.DataFrame:
        """
        Return the distinct (source_type, target_type[, qualifier]) combinations
        present in the E2O relations.

        For ``direction="source"`` the source type is the event activity and the
        target type is the object type; for ``direction="target"`` they are swapped.

        Args:
            direction (SUMMARY_DIRECTION, optional):
                Perspective from which source/target types are read. Defaults to
                ``"source"``.
            source_types: Optional source types to keep (all if empty).
            target_types: Optional target types to keep (all if empty).
            qualifiers: Optional qualifiers to keep (all if empty).
            with_qualifier: Whether to include the qualifier in the combinations.
                When ``False`` combinations are deduplicated per
                (source_type, target_type). Defaults to ``True``.

        Returns:
            DataFrame: One row per distinct relation combination.
        """
        is_source = direction == "source"

        return get_relation_combination(
            relation_table=self.df,
            source_type_field=E2O_ACTIVITY if is_source else E2O_OBJECT_TYPE,
            target_type_field=E2O_OBJECT_TYPE if is_source else E2O_ACTIVITY,
            qualifier_field=E2O_QUALIFIER if with_qualifier else None,
            source_types=list(source_types),
            target_types=list(target_types),
            qualifiers=list(qualifiers),
        )

    @property
    @instance_lru_cache()
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
