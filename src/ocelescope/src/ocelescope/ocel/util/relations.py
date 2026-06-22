from typing import Literal, cast

import pandas as pd

SUMMARY_DIRECTION = Literal["source", "target"]


def summarize_relation(
    relation_table: pd.DataFrame,
    source_id_field: str,
    target_id_field: str,
    source_type_field: str,
    target_type_field: str,
    source_type_map: pd.Series,
    qualifier_field: str | None = None,
    filter_df: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """
    Summarize relation multiplicities per (source_type, target_type[, qualifier]).

    For each combination, computes the ``min``/``max``/``sum`` number of targets a
    single source instance is related to. Source instances that have no matching
    relation are absent from the table, so ``source_type_map`` (an id → type Series
    covering every source instance) is used to detect them and set ``min`` to 0.

    Args:
        relation_table: Type-enriched relation table.
        source_id_field: Column holding the source instance id.
        target_id_field: Column holding the target instance id.
        source_type_field: Column holding the source type.
        target_type_field: Column holding the target type.
        source_type_map: Series indexed by source id with the source type as value.
        qualifier_field: Optional qualifier column to break the summary down by.
        filter_df: Optional table to inner/right-join against to restrict the rows.

    Returns:
        DataFrame indexed by (source_type, target_type[, qualifier]) with the
        columns ``min``, ``max`` and ``sum``.
    """
    filtered_relations = relation_table

    if filter_df is not None:
        filtered_relations = filtered_relations.merge(filter_df, how="right")

    group_fields = [source_id_field, source_type_field, target_type_field]
    summary_fields = [source_type_field, target_type_field]

    if qualifier_field is not None:
        group_fields.append(qualifier_field)
        summary_fields.append(qualifier_field)

    relation_counts = filtered_relations.groupby(group_fields)[target_id_field].count()

    summary = relation_counts.groupby(summary_fields).agg(["min", "max", "sum"])

    # Source instances with no matching relation are absent from relation_counts,
    # so per combination compare the number of contributing source instances to
    # the total instances of that source type; if some are missing, min is 0.
    contributing = relation_counts.groupby(summary_fields).size()
    totals_by_type = source_type_map.value_counts()
    expected = summary.index.get_level_values(source_type_field).map(totals_by_type)

    summary.loc[contributing.to_numpy() < expected.to_numpy(), "min"] = 0

    return cast(pd.DataFrame, summary)


def get_relation_combination(
    relation_table: pd.DataFrame,
    source_type_field: str,
    target_type_field: str,
    qualifier_field: str | None = None,
    source_types: list[str] | None = None,
    target_types: list[str] | None = None,
    qualifiers: list[str] | None = None,
) -> pd.DataFrame:
    """
    Return the distinct (source_type, target_type[, qualifier]) combinations.

    Optionally restricts the result to the given source types, target types and
    qualifiers before deduplicating.

    Args:
        relation_table: Type-enriched relation table.
        source_type_field: Column holding the source type.
        target_type_field: Column holding the target type.
        qualifier_field: Optional qualifier column to include.
        source_types: Source types to keep (all if empty).
        target_types: Target types to keep (all if empty).
        qualifiers: Qualifiers to keep (all if empty).

    Returns:
        DataFrame with one row per distinct combination.
    """
    filter_mask = pd.Series(data=True, index=relation_table.index)

    if source_types:
        filter_mask &= relation_table[source_type_field].isin(source_types)

    if target_types:
        filter_mask &= relation_table[target_type_field].isin(target_types)

    if qualifiers and qualifier_field is not None:
        filter_mask &= relation_table[qualifier_field].isin(qualifiers)

    return cast(
        pd.DataFrame,
        relation_table.loc[filter_mask][
            [source_type_field, target_type_field]
            + ([qualifier_field] if qualifier_field is not None else [])
        ].drop_duplicates(),
    )
