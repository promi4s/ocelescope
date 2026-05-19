import math
from copy import Error
from typing import Iterable, TypeVar, cast

import numpy as np
import pandas as pd
from ocelescope.ocel.constants import ACTIVITY_COL
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
from ocelescope_module_ocelot.models import OcelEntity, PaginatedResponse

T = TypeVar("T")


def to_python_scalar(x):
    if isinstance(x, np.generic):
        return x.item()
    return x


def get_non_null(values: Iterable[T | None]) -> T | None:
    for value in values:
        if pd.notna(value):
            return to_python_scalar(value)
    return None


def get_paginated_event_table(
    ocel: OCEL,
    page_size: int,
    page_index: int,
    activity: str,
    sort_by: str | None = None,
    ascending: bool = True,
):
    events_table = ocel.events.df.loc[ocel.events.df[ACTIVITY_COL].eq(activity)]

    total_entities = len(events_table)

    total_pages = math.ceil(total_entities / page_size)

    if sort_by is not None:
        events_table = events_table.sort_values(by=sort_by, ascending=ascending)

    total_entities = len(events_table)

    total_pages = math.ceil(total_entities / page_size)

    if page_index > total_pages:
        raise Error

    events_table = events_table.iloc[
        (page_index - 1) * page_size : (page_index) * page_size
    ]

    e2o_table = (
        ocel.e2o.df.loc[ocel.e2o.df[EID_COL].isin(events_table[EID_COL])]
        .groupby([EID_COL, E2O_QUALIFIER, OTYPE_COL])[OID_COL]
        .agg(list)
    )

    return PaginatedResponse(
        page=page_index,
        page_size=page_size,
        total_pages=total_pages,
        total_items=total_entities,
        items=[
            OcelEntity(
                id=str(id),
                timestamp=attributes[TIMESTAMP_COL],
                attributes={
                    str(a): to_python_scalar(b)
                    if type(b) is not list
                    else get_non_null(reversed(b))
                    for a, b in attributes.items()
                    if a not in [TIMESTAMP_COL, ACTIVITY_COL]
                },
                relations={
                    str(get_non_null(cast(list, index)[1:])): objects
                    for index, objects in e2o_table.loc[[str(id)]].items()
                }
                if id in e2o_table.index.get_level_values(0)
                else {},
            )
            for id, attributes in events_table.set_index(EID_COL).iterrows()
        ],
    )


def get_paginated_object_table(
    ocel: OCEL,
    page_size: int,
    page_index: int,
    object_type: str,
    sort_by: str | None = None,
    ascending: bool = True,
):
    object_table = ocel.objects.df
    object_table = object_table.loc[object_table[OTYPE_COL].eq(object_type)].set_index(
        OID_COL
    )

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

    total_objects = len(object_table)

    total_pages = math.ceil(total_objects / page_size)

    object_table = object_table.iloc[
        (page_index - 1) * page_size : (page_index) * page_size
    ]

    changes_table = ocel.objects.changes.loc[
        ocel.objects.changes[OID_COL].isin(object_table.index)
    ].dropna(axis=1, how="all")

    if not changes_table.empty:
        dynamic_attr = changes_table["ocel:field"].drop_duplicates()
        dynamic_attributes_aggr = {field: (field, list) for field in dynamic_attr}

        changes_table = changes_table.groupby(OID_COL).agg(
            **dynamic_attributes_aggr, **{TIMESTAMP_COL: (TIMESTAMP_COL, list)}
        )

        object_table = object_table.merge(
            changes_table,
            how="left",
            left_index=True,
            right_index=True,
            suffixes=("", "_new"),
        )

        for col in dynamic_attr:
            object_table[col] = object_table[f"{col}_new"].combine_first(
                object_table[col].astype(object)
            )

        object_table = object_table.drop(columns=[f"{col}_new" for col in dynamic_attr])

    o2o_table = (
        ocel.o2o.typed_df.loc[ocel.o2o.df[O2O_SOURCE_ID].isin(object_table.index)]
        .groupby([O2O_SOURCE_ID, O2O_QUALIFIER, O2O_TARGET_TYPE])[O2O_TARGET_ID]
        .agg(list)
    )

    object_table = object_table.dropna(axis=1, how="all").drop(OTYPE_COL, axis=1)

    return PaginatedResponse(
        page=page_index,
        page_size=page_size,
        total_pages=total_pages,
        total_items=total_objects,
        items=[
            OcelEntity(
                id=str(id),
                attributes={
                    str(a): to_python_scalar(b)
                    if not isinstance(b, Iterable) or isinstance(b, (str, bytes, dict))
                    else get_non_null(reversed(b))
                    for a, b in attributes.items()
                    if a != TIMESTAMP_COL
                },
                relations={
                    str(get_non_null(cast(list, index)[1:])): list(objects)
                    for index, objects in o2o_table.loc[[str(id)]].items()
                }
                if id in o2o_table.index.get_level_values(0)
                else {},
            )
            for id, attributes in object_table.iterrows()
        ],
    )
