from __future__ import annotations

from typing import Any

import duckdb
import pandas as pd
import polars as pl

from ocelescope.ocel.constants.pm4py import (
    O2O_QUALIFIER,
    O2O_SOURCE_ID,
    O2O_SOURCE_TYPE,
    O2O_TARGET_ID,
    O2O_TARGET_TYPE,
    OID_COL,
    OTYPE_COL,
)
from ocelescope.ocel.managers.base import BaseManager
from ocelescope.ocel.util.relations import (
    SUMMARY_DIRECTION,
    get_relation_combination,
    summarize_relation,
)
from ocelescope.util.cache import instance_lru_cache

TABLE = "o2o"
_OBJECTS_TABLE = "objects"


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

    @property
    def table(self) -> duckdb.DuckDBPyRelation:
        """
        Return the O2O relation table as a lazy DuckDB relation.

        Columns follow the canonical constants (O2O_SOURCE_ID, O2O_TARGET_ID,
        O2O_QUALIFIER), which is how the table is stored -- so nothing is derived
        here and assigning it back is a straight replace.

        Returns:
            DuckDBPyRelation: A lazy relation over all O2O relations.
        """
        return self._relation(
            f'SELECT "{O2O_SOURCE_ID}", "{O2O_TARGET_ID}", "{O2O_QUALIFIER}" FROM {TABLE}'
        )

    @table.setter
    def table(self, contents: Any) -> None:
        self._replace(TABLE, contents)

    @property
    def df(self) -> pd.DataFrame:
        """
        Return the O2O relation table with normalized column names.

        Read from the OCEL's DuckDB database on every access. The source and
        target objects are named by the canonical constants:

            - O2O_SOURCE_ID
            - O2O_TARGET_ID

        Returns:
            DataFrame: A normalized O2O relation table.
        """
        return self.table.df()

    @df.setter
    def df(self, contents: pd.DataFrame) -> None:
        self._replace(TABLE, contents)

    @property
    def pl(self) -> pl.LazyFrame:
        """
        Return the O2O relation table as a polars LazyFrame.

        Nothing is read until it is collected.

        Each access is its own scan, bound to its own cursor -- so read it freshly
        at each use rather than storing it in a variable and reusing it. One
        LazyFrame cannot be read twice within a single query.

        Returns:
            polars.LazyFrame: A normalized O2O relation table.
        """
        return self.table.pl(lazy=True)

    @pl.setter
    def pl(self, contents: pl.LazyFrame | pl.DataFrame) -> None:
        self._replace(TABLE, contents)

    @property
    def typed_table(self) -> duckdb.DuckDBPyRelation:
        """
        Return the O2O relations with each end's object type joined on, lazily.

        Adds two columns to the normalized O2O table:

            - O2O_SOURCE_TYPE
            - O2O_TARGET_TYPE

        The joins are outer, so a relation naming an object the log does not have
        keeps its row and gets a null type rather than disappearing.

        Returns:
            DuckDBPyRelation: A lazy relation over the type-enriched O2O table.
        """
        return self._relation(
            f'SELECT r.*, s."{OTYPE_COL}" AS "{O2O_SOURCE_TYPE}", '
            f't."{OTYPE_COL}" AS "{O2O_TARGET_TYPE}" '
            f'FROM (SELECT "{O2O_SOURCE_ID}", "{O2O_TARGET_ID}", "{O2O_QUALIFIER}" '
            f"FROM {TABLE}) r "
            f'LEFT JOIN {_OBJECTS_TABLE} s ON r."{O2O_SOURCE_ID}" = s."{OID_COL}" '
            f'LEFT JOIN {_OBJECTS_TABLE} t ON r."{O2O_TARGET_ID}" = t."{OID_COL}"'
        )

    @property
    def typed_pl(self) -> pl.LazyFrame:
        """
        Return the type-enriched O2O relation table as a polars LazyFrame.

        Returns:
            polars.LazyFrame: A type-enriched O2O relation table.
        """
        return self.typed_table.pl(lazy=True)

    @property
    @instance_lru_cache()
    def typed_df(self) -> pd.DataFrame:
        """
        Return the O2O relation table enriched with object types.

        Returns:
            DataFrame: A type-enriched O2O relation table.
        """
        return self.typed_table.df()

    def summary(
        self,
        direction: SUMMARY_DIRECTION = "source",
        filter_df: pd.DataFrame | None = None,
        with_qualifier: bool = True,
    ) -> pd.DataFrame:
        """
        Compute summary statistics for O2O relationships.

        Summaries include min/max/total numbers of target objects
        per source object, grouped by type and (optionally) qualifier.

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
                ``min``, ``max`` and ``sum`` of related objects per source object.
        """
        is_source = direction == "source"

        return summarize_relation(
            relation_table=self.typed_df,
            source_id_field=O2O_SOURCE_ID if is_source else O2O_TARGET_ID,
            target_id_field=O2O_TARGET_ID if is_source else O2O_SOURCE_ID,
            source_type_field=O2O_SOURCE_TYPE if is_source else O2O_TARGET_TYPE,
            target_type_field=O2O_TARGET_TYPE if is_source else O2O_SOURCE_TYPE,
            source_type_map=self._ocel.objects.type_by_id,
            qualifier_field=O2O_QUALIFIER if with_qualifier else None,
            filter_df=filter_df,
        )

    @property
    @instance_lru_cache()
    def qualifiers(self) -> list[str]:
        """
        Return the list of all qualifiers present in the O2O relations.

        Returns:
            list[str]: Sorted list of unique qualifier names.
        """
        return sorted(self.df[O2O_QUALIFIER].dropna().unique().tolist())

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
        present in the O2O relations.

        Args:
            direction (SUMMARY_DIRECTION, optional):
                Whether source/target types are read from the source or the target
                side of the relation. Defaults to ``"source"``.
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
            relation_table=self.typed_df,
            source_type_field=O2O_SOURCE_TYPE if is_source else O2O_TARGET_TYPE,
            target_type_field=O2O_TARGET_TYPE if is_source else O2O_SOURCE_TYPE,
            qualifier_field=O2O_QUALIFIER if with_qualifier else None,
            source_types=list(source_types),
            target_types=list(target_types),
            qualifiers=list(qualifiers),
        )
