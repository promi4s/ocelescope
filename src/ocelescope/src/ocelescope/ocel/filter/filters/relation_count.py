from typing import Literal, Optional

import pandas as pd
from pydantic import BaseModel

from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    E2O_ACTIVITY,
    E2O_EVENT_ID,
    E2O_OBJECT_ID,
    E2O_OBJECT_TYPE,
    E2O_QUALIFIER,
    EID_COL,
    O2O_QUALIFIER,
    O2O_SOURCE_ID,
    O2O_SOURCE_TYPE,
    O2O_TARGET_ID,
    O2O_TARGET_TYPE,
    OID_COL,
    OTYPE_COL,
)
from ocelescope.ocel.filter.base import BaseFilter, FilterResult


class RelationCountFilterConfig(BaseModel):
    source: str
    target: str
    range: tuple[Optional[int], Optional[int]]
    qualifier: Optional[str] = None


def filter_by_relation_counts(
    source: str,
    target: str,
    entity_df: pd.DataFrame,
    relation_df: pd.DataFrame,
    source_type_name: str,
    target_type_name: str,
    qualifier_field_name: str,
    counted_id_name: str,
    counted_type_value: str,
    type_name: str,
    id_name: str,
    qualifier: str | None,
    min_count: int | None,
    max_count: int | None,
) -> pd.Series:
    mask = relation_df[source_type_name].eq(source) & relation_df[target_type_name].eq(target)

    if qualifier is not None:
        mask &= relation_df[qualifier_field_name].eq(qualifier)

    relation_count: pd.Series = relation_df.loc[mask].groupby(counted_id_name).size()

    all_counted_ids = entity_df.loc[entity_df[type_name].eq(counted_type_value), id_name].to_list()

    relation_count = relation_count.reindex(all_counted_ids, fill_value=0)

    relation_mask = pd.Series(True, index=relation_count.index, dtype=bool)

    if min_count is not None:
        relation_mask = relation_mask & relation_count.ge(min_count)

    if max_count is not None:
        relation_mask = relation_mask & relation_count.le(max_count)

    matching_ids = relation_count.index[relation_mask].to_list()

    is_counted_entity = entity_df[type_name].eq(counted_type_value)
    is_matching_entity = entity_df[id_name].isin(matching_ids)

    return ~is_counted_entity | is_matching_entity


class E2OCountFilter(BaseFilter, RelationCountFilterConfig):
    direction: Literal["source", "target"] = "source"

    def filter(self, ocel):

        is_source = self.direction == "source"

        mask = filter_by_relation_counts(
            entity_df=ocel.events.df if is_source else ocel.objects.df,
            relation_df=ocel.e2o.typed_df,
            source=self.source,
            target=self.target,
            qualifier=self.qualifier,
            source_type_name=E2O_ACTIVITY,
            target_type_name=E2O_OBJECT_TYPE,
            qualifier_field_name=E2O_QUALIFIER,
            counted_id_name=E2O_EVENT_ID if is_source else E2O_OBJECT_ID,
            counted_type_value=self.source if is_source else self.target,
            id_name=EID_COL if is_source else OID_COL,
            type_name=ACTIVITY_COL if is_source else OTYPE_COL,
            min_count=self.range[0],
            max_count=self.range[1],
        )

        return FilterResult(
            events=mask if is_source else None, objects=mask if not is_source else None
        )


class O2OCountFilter(BaseFilter, RelationCountFilterConfig):
    direction: Literal["source", "target"] = "source"

    def filter(self, ocel):
        is_source = self.direction == "source"

        mask = filter_by_relation_counts(
            entity_df=ocel.objects.df,
            relation_df=ocel.o2o.typed_df,
            source=self.source,
            target=self.target,
            qualifier=self.qualifier,
            source_type_name=O2O_SOURCE_TYPE,
            target_type_name=O2O_TARGET_TYPE,
            qualifier_field_name=O2O_QUALIFIER,
            counted_id_name=O2O_SOURCE_ID if is_source else O2O_TARGET_ID,
            counted_type_value=self.source if is_source else self.target,
            id_name=OID_COL,
            type_name=OTYPE_COL,
            min_count=self.range[0],
            max_count=self.range[1],
        )

        return FilterResult(objects=mask)
