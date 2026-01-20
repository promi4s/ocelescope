from math import ceil
from typing import Literal, Optional, Tuple, cast

import pandas as pd
from ocelescope import OCEL
from pandas import DataFrame

from modules.ocelot.models import ObjectChange, OcelEntity, PaginatedResponse


def get_sorted_table(
    dataframe: DataFrame,
    type_field: str,
    type_value: str,
    sort_by: Optional[Tuple[str, Literal["asc", "desc"]]] = None,
):
    table = dataframe[dataframe[type_field] == type_value].copy()

    if sort_by:
        table = table.sort_values(
            by=sort_by[0], ascending=True if sort_by[1] == "asc" else False
        )  # type: ignore

    return table


def get_paginated_dataframe(
    df: DataFrame,
    non_attribute_fields: list[str],
    page: int,
    page_size: int,
    relation_table: DataFrame,
    from_field: str,
    to_field: str,
) -> PaginatedResponse:
    start = (page - 1) * page_size
    end = start + page_size
    paginated_df = df.iloc[start:end].copy()
    total_items = len(df)
    total_pages = ceil(total_items / page_size)

    related = relation_table[relation_table[from_field].isin(paginated_df[from_field])]

    relations = related.pivot_table(
        index=from_field,
        columns=["ocel:qualifier", "ocel:type"],
        values=to_field,
        aggfunc=lambda x: list(x),
    ).reset_index()

    relations.columns = [
        col
        if not isinstance(col, tuple)
        else f"{col[0]}::{col[1]}"
        if col[0] != from_field
        else col[0]
        for col in relations.columns
    ]

    relations["relations"] = relations.drop(columns=[from_field]).to_dict(
        orient="records"
    )
    relations = relations[[from_field, "relations"]]

    paginated_df = paginated_df.dropna(axis=1, how="all")

    columns_to_drop = [
        col for col in non_attribute_fields if col in paginated_df.columns
    ]
    attribute_data = paginated_df.drop(columns=columns_to_drop)

    if attribute_data.shape[1] == 0:
        paginated_df["attributes"] = [{} for _ in range(len(paginated_df))]
    else:
        paginated_df["attributes"] = attribute_data.to_dict(orient="records")

    merged = pd.merge(paginated_df, relations, on=from_field, how="left")

    merged["relations"] = merged["relations"].apply(
        lambda r: {
            k: v if isinstance(v, list) else []
            for k, v in (r if isinstance(r, dict) else {}).items()
        }
    )

    items = [
        OcelEntity(
            id=row[from_field],  # type:ignore
            timestamp=row.get("ocel:timestamp"),
            attributes=row["attributes"],  # type:ignore
            relations=row["relations"],  # type:ignore
        )
        for _, row in merged.iterrows()
    ]

    return PaginatedResponse(
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        total_items=total_items,
        items=items,
    )


def get_object_history(ocel: OCEL, object_id: str):
    object_changes = ocel.objects.changes
    object_changes = object_changes[
        object_changes[ocel.ocel.object_id_column] == object_id
    ]
    object_changes = object_changes[
        [ocel.ocel.event_timestamp] + ocel.objects.attribute_names
    ]

    return [
        ObjectChange(
            timestamp=row[ocel.ocel.event_timestamp].isoformat(),
            attributes={
                key: None if pd.isna(value) else value
                for key, value in row.items()
                if key != ocel.ocel.event_timestamp
            },
        )
        for row in cast(DataFrame, object_changes).to_dict(orient="records")
    ]
