from __future__ import annotations

import pandas as pd
import polars as pl
from polars import DataFrame, LazyFrame

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

    Stores the E2O relation table internally as a polars DataFrame, using
    canonical column names, and exposes it as a typed and normalized
    pandas-compatible facade.
    """

    def __init__(self, ocel, e2o_df: DataFrame | LazyFrame | None = None):
        """
        Args:
            ocel: The owning OCEL instance.
            e2o_df: Initial E2O relation table, using canonical column names.
                Defaults to an empty table.
        """
        super().__init__(ocel)

        self._e2o_df = (
            e2o_df
            if e2o_df is not None
            else pl.DataFrame(
                schema={
                    E2O_EVENT_ID: pl.String,
                    E2O_ACTIVITY: pl.String,
                    TIMESTAMP_COL: pl.Datetime,
                    E2O_OBJECT_ID: pl.String,
                    E2O_OBJECT_TYPE: pl.String,
                    E2O_QUALIFIER: pl.String,
                }
            )
        )

    # ---------------------------------------------------------
    # Raw → Normalized E2O DataFrame
    # ---------------------------------------------------------
    @property
    def df(self) -> pd.DataFrame:
        """
        Return the E2O relation table as a pandas DataFrame, converted from
        the internal polars representation.

        Columns already use canonical constant names (E2O_EVENT_ID,
        E2O_OBJECT_ID, E2O_OBJECT_TYPE, ...), since the underlying PM4PY
        column names coincide with these constants.

        Returns:
            DataFrame: Normalized E2O relation table.
        """
        return self.pl.collect().to_pandas()

    @df.setter
    def df(self, value: pd.DataFrame) -> None:
        """Replace the E2O relation table, converting it back to polars internally."""
        self._e2o_df = pl.from_pandas(value)
        self.cache.clear()

    @property
    def pl(self) -> LazyFrame:
        """Return the E2O relation table as a polars LazyFrame.

        Eagerly-provided tables are wrapped via ``DataFrame.lazy()``; tables
        provided lazily (from :meth:`OCEL.scan`) are returned as-is, so any
        downstream filter/projection stays deferred until the caller
        ``.collect()``s and can be pushed into the scan.

        Note: a scanned table is re-read from disk on each ``.collect()`` (there
        is no materialization cache); collect once and reuse the result if you
        need it repeatedly.
        """
        src = self._e2o_df
        return src if isinstance(src, LazyFrame) else src.lazy()

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
