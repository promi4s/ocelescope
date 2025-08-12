from typing import Literal, Optional, cast

import pandas as pd
from pm4py.objects.ocel.obj import OCEL
from pydantic.main import BaseModel


class RelationCountSummary(BaseModel):
    qualifier: str
    source: str
    target: str
    min_count: int
    max_count: int
    sum: int


def getO2OWithTypes(ocel, direction: Literal["source", "target"] = "source"):
    o2o_with_types = pd.merge(
        ocel.o2o,
        ocel.objects[[ocel.object_id_column, ocel.object_type_column]],
        how="left",
    )
    o2o_with_types = pd.merge(
        o2o_with_types,
        ocel.objects[[ocel.object_id_column, ocel.object_type_column]],
        how="left",
        left_on=f"{ocel.object_id_column}_2",
        right_on=ocel.object_id_column,
        suffixes=["", "_new"],  # type:ignore
    )
    o2o_with_types = o2o_with_types[
        [
            ocel.object_id_column,
            f"{ocel.object_id_column}_2",
            ocel.qualifier,
            ocel.object_type_column,
            f"{ocel.object_type_column}_new",
        ]
    ]
    rename_map = {
        ocel.object_id_column: direction,
        f"{ocel.object_id_column}_2": "target" if direction == "source" else "source",
        ocel.qualifier: "qualifier",
        ocel.object_type_column: f"{direction}_type",
        f"{ocel.object_type_column}_new": f"{'target' if direction == 'source' else 'source'}_type",
    }
    return o2o_with_types.rename(columns=rename_map)  # type:ignore


def summarize_relation_counts(
    relation_table: pd.DataFrame,
    qualifier_col: str,
    source_type_col: str,
    target_type_col: str,
    source_id_col: str,
    source_df: pd.DataFrame,
) -> list[RelationCountSummary]:
    grouped_relations = (
        relation_table.groupby([source_id_col, qualifier_col, source_type_col, target_type_col])
        .size()
        .reset_index()
        .rename(columns={0: "count"})
    )

    summary = (
        grouped_relations.groupby([qualifier_col, source_type_col, target_type_col])["count"]
        .agg(["min", "max", "sum"])
        .reset_index()
        .rename(columns={"min": "min_count", "max": "max_count"})
    )

    # Check if any relations are optional
    source_ids_with_possible_relations = pd.merge(
        source_df[[source_id_col, source_type_col]],
        summary[[source_type_col, qualifier_col, target_type_col]],
        on=source_type_col,
    )
    source_ids_with_relations = pd.merge(
        source_ids_with_possible_relations,
        relation_table[[source_id_col, qualifier_col, target_type_col]],
        on=[source_id_col, qualifier_col, target_type_col],
        how="left",
        indicator=True,
    )
    unmatched_relations = source_ids_with_relations[
        source_ids_with_relations["_merge"] == "left_only"
    ]

    unmatched_relations = set(
        unmatched_relations[[source_type_col, qualifier_col, target_type_col]]
        .drop_duplicates()  # type:ignore
        .itertuples(index=False, name=None)
    )

    summaries = [
        RelationCountSummary(
            qualifier=cast(str, row[qualifier_col]),
            source=cast(str, row[source_type_col]),
            target=cast(str, row[target_type_col]),
            min_count=(
                0
                if (row[source_type_col], row[qualifier_col], row[target_type_col])
                in unmatched_relations
                else cast(int, row["min_count"])
            ),
            max_count=cast(int, row["max_count"]),
            sum=cast(int, row["sum"]),
        )
        for _, row in summary.iterrows()
    ]

    return summaries


def summarize_e2o_counts(
    ocel: OCEL, direction: Optional[Literal["source", "target"]] = "source"
) -> list[RelationCountSummary]:
    source_id_col = ocel.event_id_column if direction == "source" else ocel.object_id_column
    source_type_col = ocel.event_activity if direction == "source" else ocel.object_type_column

    source_df = ocel.events if direction == "source" else ocel.objects

    target_type_col = ocel.object_type_column if direction == "source" else ocel.event_activity

    return summarize_relation_counts(
        relation_table=ocel.relations,
        qualifier_col=ocel.qualifier,
        source_type_col=source_type_col,
        target_type_col=target_type_col,
        source_id_col=source_id_col,
        source_df=source_df,
    )


def summarize_o2o_counts(ocel: OCEL, direction: Optional[Literal["source", "target"]] = "source"):
    o2o = getO2OWithTypes(ocel, direction=direction or "source")

    return summarize_relation_counts(
        relation_table=o2o,
        qualifier_col="qualifier",
        source_type_col="source_type",
        target_type_col="target_type",
        source_id_col="source",
        source_df=ocel.objects.rename(
            columns={
                ocel.object_id_column: "source",
                ocel.object_type_column: "source_type",
            }
        ),
    )
