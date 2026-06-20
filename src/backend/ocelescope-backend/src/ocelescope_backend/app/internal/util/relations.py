from typing import Literal

from ocelescope_backend.app.internal.model.base import PaginatedResponse
from ocelescope_backend.app.internal.model.relations import RelationCountSummary

RelationSortField = Literal["source", "target", "qualifier"]

_RELATION_SORT_LEVELS = {"source": 0, "target": 1, "qualifier": 2}


def relation_summary(
    relations,  # ocel.e2o or ocel.o2o
    direction: Literal["source", "target"],
    source_types: list[str] | None,
    target_types: list[str] | None,
    qualifiers: list[str] | None,
    sort_by: RelationSortField | None,
    order: Literal["asc", "desc"],
    page: int | None,
    page_size: int | None,
) -> PaginatedResponse[list[RelationCountSummary]]:
    """Build a paginated relation-count summary for an E2O/O2O manager.

    The paginated rows are the distinct (source, target, qualifier) combinations.
    They are sorted and sliced first so only the current page gets summarized,
    which keeps the groupby small on large OCELs.
    """
    ascending = order == "asc"
    combinations = relations.combinations(
        direction,
        tuple(source_types or ()),
        tuple(target_types or ()),
        tuple(qualifiers or ()),
    )

    if sort_by in _RELATION_SORT_LEVELS:
        sort_column = combinations.columns[_RELATION_SORT_LEVELS[sort_by]]
        combinations = combinations.sort_values(sort_column, ascending=ascending)

    total_items = len(combinations)
    effective_page = page or 1
    effective_page_size = page_size or total_items or 1
    start = (effective_page - 1) * effective_page_size
    combinations = combinations.iloc[start : start + effective_page_size]

    summary = relations.summary(direction=direction, filter_df=combinations)

    if sort_by in _RELATION_SORT_LEVELS:
        summary = summary.sort_index(
            level=_RELATION_SORT_LEVELS[sort_by], ascending=ascending
        )

    return PaginatedResponse(
        response=RelationCountSummary.from_summary(summary),
        page=effective_page,
        page_size=effective_page_size,
        total_items=total_items,
    )
