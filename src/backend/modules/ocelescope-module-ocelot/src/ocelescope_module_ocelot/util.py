import math
from typing import Any, Iterable, TypeVar

import numpy as np
import pandas as pd
from ocelescope.ocel.constants import (
    ACTIVITY_COL,
    E2O_ACTIVITY,
    E2O_OBJECT_TYPE,
    O2O_SOURCE_TYPE,
)
from ocelescope.ocel.constants.pm4py import (
    E2O_QUALIFIER,
    EID_COL,
    O2O_QUALIFIER,
    O2O_SOURCE_ID,
    O2O_TARGET_ID,
    O2O_TARGET_TYPE,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.util.pandas import coerce_series

from ocelescope import OCEL
from ocelescope_module_ocelot.models import (
    EntityTableColumn,
    OcelEntity,
    PaginatedResponse,
)

T = TypeVar("T")


def to_python_scalar(value: Any) -> Any:
    if isinstance(value, np.generic):
        return value.item()
    return value


def none_or_python_value(value: Any) -> Any | None:
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    if pd.api.types.is_scalar(value) and pd.isna(value):
        return None
    return to_python_scalar(value)


def first_present(values: Iterable[Any]) -> Any | None:
    for value in values:
        cleaned_value = none_or_python_value(value)
        if cleaned_value is not None:
            return cleaned_value
    return None


def relation_accessor(parts: Iterable[Any]) -> str:
    return str(first_present(parts))


def paginate_df(
    df: pd.DataFrame,
    page_size: int,
    page_index: int,
) -> tuple[pd.DataFrame, int, int]:
    if page_size <= 0:
        raise ValueError("page_size must be greater than 0")
    if page_index <= 0:
        raise ValueError("page_index must be greater than 0")

    total_items = len(df)
    total_pages = math.ceil(total_items / page_size) if total_items else 0

    if total_pages > 0 and page_index > total_pages:
        raise ValueError(f"page_index {page_index} exceeds total_pages {total_pages}")

    start = (page_index - 1) * page_size
    end = page_index * page_size
    return df.iloc[start:end], total_items, total_pages


def serialize_object_attribute(value: Any) -> Any:
    if isinstance(value, (str, bytes, dict)) or not isinstance(value, Iterable):
        return to_python_scalar(value)

    return first_present(reversed(value))


def get_object_columns_def(
    ocel: OCEL,
    object_type: str,
) -> list[EntityTableColumn]:
    typed_o2o = ocel.o2o.typed_df

    relation_rows = typed_o2o.loc[
        typed_o2o[O2O_SOURCE_TYPE].eq(object_type)
    ].drop_duplicates([O2O_TARGET_TYPE, O2O_QUALIFIER])[
        [O2O_TARGET_TYPE, O2O_QUALIFIER]
    ]

    relation_columns = [
        EntityTableColumn(
            accessor=relation_accessor([qualifier, target_object_type]),
            type="relation",
            title=f"{qualifier} ({target_object_type})",
        )
        for _, target_object_type, qualifier in relation_rows.itertuples()
    ]

    attribute_columns = [
        EntityTableColumn(accessor=attribute, type="attribute")
        for _, attribute in ocel.attributes.get_object_summary(
            object_types=[object_type]
        ).index
    ]

    return [
        EntityTableColumn(accessor="id", type="relation", title="#"),
        *attribute_columns,
        *relation_columns,
    ]


def get_activity_columns_def(
    ocel: OCEL,
    activity_name: str,
) -> list[EntityTableColumn]:
    typed_e2o = ocel.e2o.df

    relation_rows = typed_e2o.loc[
        typed_e2o[E2O_ACTIVITY].eq(activity_name)
    ].drop_duplicates([E2O_OBJECT_TYPE, E2O_QUALIFIER])[
        [E2O_OBJECT_TYPE, E2O_QUALIFIER]
    ]

    relation_columns = [
        EntityTableColumn(
            accessor=relation_accessor([qualifier, object_type]),
            type="relation",
            title=f"{qualifier} ({object_type})",
        )
        for _, object_type, qualifier in relation_rows.itertuples()
    ]

    attribute_columns = [
        EntityTableColumn(accessor=attribute, type="attribute")
        for _, attribute in ocel.attributes.get_activity_summary(
            activities=[activity_name]
        ).index
    ]

    return [
        EntityTableColumn(accessor="id", title="#", type="attribute"),
        EntityTableColumn(
            accessor="timestamp",
            title="Timestamp",
            type="attribute",
        ),
        *attribute_columns,
        *relation_columns,
    ]


def get_paginated_event_table(
    ocel: OCEL,
    page_size: int,
    page_index: int,
    activity: str,
    sort_by: str | None = None,
    ascending: bool = True,
) -> PaginatedResponse:
    events_table = ocel.events.df.loc[ocel.events.df[ACTIVITY_COL].eq(activity)]

    if sort_by is not None:
        events_table = events_table.sort_values(by=sort_by, ascending=ascending)

    events_table, total_entities, total_pages = paginate_df(
        events_table,
        page_size=page_size,
        page_index=page_index,
    )

    events_table = events_table.dropna(axis=1, how="all")

    e2o_table = (
        ocel.e2o.df.loc[ocel.e2o.df[EID_COL].isin(events_table[EID_COL])]
        .groupby([EID_COL, E2O_QUALIFIER, OTYPE_COL])[OID_COL]
        .agg(list)
    )

    e2o_entity_ids = set(e2o_table.index.get_level_values(0))

    return PaginatedResponse(
        page=page_index,
        page_size=page_size,
        total_pages=total_pages,
        total_items=total_entities,
        items=[
            OcelEntity(
                id=str(entity_id),
                timestamp=row[TIMESTAMP_COL],
                attributes={
                    str(column_name): to_python_scalar(value)
                    for column_name, value in row.items()
                    if column_name not in [TIMESTAMP_COL, ACTIVITY_COL]
                },
                relations={
                    relation_accessor(index[1:]): objects
                    for index, objects in e2o_table.loc[[str(entity_id)]].items()
                }
                if entity_id in e2o_entity_ids
                else {},
            )
            for entity_id, row in events_table.set_index(EID_COL).iterrows()
        ],
    )


def get_paginated_object_table(
    ocel: OCEL,
    page_size: int,
    page_index: int,
    object_type: str,
    sort_by: str | None = None,
    ascending: bool = True,
) -> PaginatedResponse:
    object_table = ocel.objects.df.loc[
        ocel.objects.df[OTYPE_COL].eq(object_type)
    ].set_index(OID_COL)

    if sort_by:
        if sort_by in ocel.objects.dynamic_attribute_names:
            changes = (
                ocel.objects.changes.loc[
                    ocel.objects.changes[OTYPE_COL].eq(object_type)
                    & ocel.objects.changes["ocel:field"].eq(sort_by),
                    [OID_COL, sort_by],
                ]
                .drop_duplicates(OID_COL, keep="last")
                .set_index(OID_COL)
            )

            if sort_by not in object_table:
                object_table[sort_by] = None

            object_table.update(changes)

        object_table[sort_by] = coerce_series(object_table[sort_by])
        object_table = object_table.sort_values(by=sort_by, ascending=ascending)

    object_table, total_objects, total_pages = paginate_df(
        object_table,
        page_size=page_size,
        page_index=page_index,
    )

    changes_table = ocel.objects.changes.loc[
        ocel.objects.changes[OID_COL].isin(object_table.index)
    ].dropna(axis=1, how="all")

    if not changes_table.empty:
        dynamic_attributes = changes_table["ocel:field"].drop_duplicates()
        dynamic_attributes_aggr = {field: (field, list) for field in dynamic_attributes}

        changes_table = changes_table.groupby(OID_COL).agg(
            **dynamic_attributes_aggr,
            **{TIMESTAMP_COL: (TIMESTAMP_COL, list)},
        )

        object_table = object_table.merge(
            changes_table,
            how="left",
            left_index=True,
            right_index=True,
            suffixes=("", "_new"),
        )

        for column_name in dynamic_attributes:
            object_table[column_name] = object_table[
                f"{column_name}_new"
            ].combine_first(object_table[column_name].astype(object))

        object_table = object_table.drop(
            columns=[f"{column_name}_new" for column_name in dynamic_attributes]
        )

    typed_o2o = ocel.o2o.typed_df
    o2o_table = (
        typed_o2o.loc[typed_o2o[O2O_SOURCE_ID].isin(object_table.index)]
        .groupby([O2O_SOURCE_ID, O2O_QUALIFIER, O2O_TARGET_TYPE])[O2O_TARGET_ID]
        .agg(list)
    )

    object_table = object_table.dropna(axis=1, how="all").drop(columns=[OTYPE_COL])

    o2o_entity_ids = set(o2o_table.index.get_level_values(0))

    return PaginatedResponse(
        page=page_index,
        page_size=page_size,
        total_pages=total_pages,
        total_items=total_objects,
        items=[
            OcelEntity(
                id=str(entity_id),
                attributes={
                    str(column_name): serialize_object_attribute(value)
                    for column_name, value in row.items()
                    if column_name != TIMESTAMP_COL
                },
                relations={
                    relation_accessor(index[1:]): list(objects)
                    for index, objects in o2o_table.loc[[str(entity_id)]].items()
                }
                if entity_id in o2o_entity_ids
                else {},
            )
            for entity_id, row in object_table.iterrows()
        ],
    )
