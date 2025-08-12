from typing import Literal, Optional, cast

import pandas as pd
from pandas.core.frame import DataFrame
from pandas.core.series import Series
from pydantic import BaseModel

from ocelescope.ocel.util.relations import getO2OWithTypes

from ocelescope.ocel.filter.base import BaseFilter, FilterResult


class RelationCountFilterConfig(BaseModel):
    source: str
    target: str
    mode: Optional[Literal["include", "exclude"]] = "include"
    range: tuple[Optional[int], Optional[int]]
    qualifier: Optional[str] = None


def filter_by_relation_counts(
    relation_table: pd.DataFrame,
    source_id_column: str,
    source_column: str,
    target_column: str,
    qualifier_column: str,
    entity_id_column: str,
    entity_type_column: str,
    source_df: pd.DataFrame,
    config: RelationCountFilterConfig,
):
    # Get o2o with types if not provided
    relation_table = cast(
        DataFrame,
        relation_table[
            (relation_table[source_column] == config.source)
            & (relation_table[target_column] == config.target)
        ],
    )

    if config.qualifier is not None:
        relation_table = cast(
            DataFrame,
            relation_table[relation_table[qualifier_column] == config.qualifier],
        )

    # Count how many times each target appears
    entity_counts = cast(Series, relation_table.groupby(source_id_column).size()).reset_index(
        name="entity_count"
    )

    min_count, max_count = config.range

    if min_count is not None:
        entity_counts = entity_counts[entity_counts["entity_count"] >= min_count]
    if max_count is not None:
        entity_counts = entity_counts[entity_counts["entity_count"] <= max_count]
    entity_counts = cast(Series, entity_counts[source_id_column])

    if min_count == 0:
        merged = pd.merge(
            source_df[source_df[entity_type_column] == config.source],
            relation_table,
            left_on=entity_id_column,
            right_on=source_id_column,
            how="left",
            indicator=True,
        )
        entities_with_no_relations = merged.loc[merged["_merge"] == "left_only", entity_id_column]

        entity_counts = pd.concat([entity_counts, entities_with_no_relations])

    # Mask for non-target-type objects (always kept)
    is_not_target_type = source_df[entity_type_column] != config.source

    # Mask for objects meeting the relation count condition
    is_in_filtered_ids = source_df[entity_id_column].isin(entity_counts)

    # Invert if in exclude mode
    if config.mode == "exclude":
        is_in_filtered_ids = ~is_in_filtered_ids

    # Final mask: keep non-target-type or qualifying objects
    final_mask = cast(Series, is_not_target_type | is_in_filtered_ids)

    return final_mask


class E2OCountFilter(BaseFilter, RelationCountFilterConfig):
    direction: Literal["source", "target"] = "source"

    def filter(self, ocel):
        source_column = (
            ocel.ocel.event_activity if self.direction == "source" else ocel.ocel.object_type_column
        )
        target_column = (
            ocel.ocel.object_type_column if self.direction == "source" else ocel.ocel.event_activity
        )
        source_id_column = (
            ocel.ocel.event_id_column if self.direction == "source" else ocel.ocel.object_id_column
        )
        entity_id_column = source_id_column
        qualifier_column = ocel.ocel.qualifier
        entity_type_column = source_column

        mask = filter_by_relation_counts(
            relation_table=ocel.relations,
            source_column=source_column,
            target_column=target_column,
            source_id_column=source_id_column,
            qualifier_column=qualifier_column,
            entity_id_column=entity_id_column,
            entity_type_column=entity_type_column,
            source_df=ocel.events if self.direction == "source" else ocel.objects,
            config=RelationCountFilterConfig(**self.model_dump()),
        )

        return FilterResult(
            events=mask if self.direction == "source" else None,
            objects=mask if self.direction == "target" else None,
        )


class O2OCountFilter(BaseFilter, RelationCountFilterConfig):
    direction: Literal["source", "target"] = "source"

    def filter(self, ocel):
        o2oTable = getO2OWithTypes(ocel.ocel, direction=self.direction)

        mask = filter_by_relation_counts(
            relation_table=o2oTable,
            source_column="source_type",
            target_column="target_type",
            source_id_column="source",
            qualifier_column="qualifier",
            entity_id_column=ocel.ocel.object_id_column,
            entity_type_column=ocel.ocel.object_type_column,
            source_df=ocel.objects,
            config=RelationCountFilterConfig(**self.model_dump()),
        )

        return FilterResult(objects=mask)
