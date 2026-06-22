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
    with_qualifier: bool = True,
) -> PaginatedResponse[list[RelationCountSummary]]:
    """Build a paginated relation-count summary for an E2O/O2O manager.

    The paginated rows are the distinct (source, target[, qualifier]) combinations.
    When ``with_qualifier`` is ``False`` the rows are aggregated per
    (source, target) across all qualifiers. They are sorted and sliced first so
    only the current page gets summarized, which keeps the groupby small on large
    OCELs.
    """
    ascending = order == "asc"
    # The qualifier level only exists when grouping with qualifiers.
    effective_sort_by = (
        None if not with_qualifier and sort_by == "qualifier" else sort_by
    )

    if not with_qualifier and qualifiers:
        # In aggregated mode the qualifier is dropped from the combinations, which
        # also drops the qualifier filter. Apply it via the qualifier-aware
        # combinations and reduce to the matching (source, target) pairs.
        combinations = (
            relations.combinations(
                direction,
                tuple(source_types or ()),
                tuple(target_types or ()),
                tuple(qualifiers),
                with_qualifier=True,
            )
            .iloc[:, :2]
            .drop_duplicates()
        )
    else:
        combinations = relations.combinations(
            direction,
            tuple(source_types or ()),
            tuple(target_types or ()),
            tuple(qualifiers or ()),
            with_qualifier=with_qualifier,
        )

    if effective_sort_by in _RELATION_SORT_LEVELS:
        sort_column = combinations.columns[_RELATION_SORT_LEVELS[effective_sort_by]]
        combinations = combinations.sort_values(sort_column, ascending=ascending)

    total_items = len(combinations)
    effective_page = page or 1
    effective_page_size = page_size or total_items or 1
    start = (effective_page - 1) * effective_page_size
    combinations = combinations.iloc[start : start + effective_page_size]

    summary = relations.summary(
        direction=direction, filter_df=combinations, with_qualifier=with_qualifier
    )

    # `combinations` was sorted to pick the right page, but `summary`'s groupby
    # re-orders the rows, so the page has to be re-sorted on the same level.
    if effective_sort_by in _RELATION_SORT_LEVELS:
        summary = summary.sort_index(
            level=_RELATION_SORT_LEVELS[effective_sort_by], ascending=ascending
        )

    qualifiers_map: dict[tuple[str, str], list[str]] | None = None
    if not with_qualifier and total_items > 0:
        qualifiers_map = _qualifiers_by_pair(relations, direction, combinations)

    return PaginatedResponse(
        response=RelationCountSummary.from_summary(summary, qualifiers_map),
        page=effective_page,
        page_size=effective_page_size,
        total_items=total_items,
    )


def _qualifiers_by_pair(
    relations,  # ocel.e2o or ocel.o2o
    direction: Literal["source", "target"],
    page_combinations,  # the (source, target) combinations for the current page
) -> dict[tuple[str, str], list[str]]:
    """Map each (source, target) pair on the page to its sorted list of qualifiers.

    Columns are read positionally: 0 = source type, 1 = target type, 2 = qualifier.
    """
    page_sources = tuple(str(value) for value in page_combinations.iloc[:, 0].unique())
    page_targets = tuple(str(value) for value in page_combinations.iloc[:, 1].unique())

    qualifier_combinations = relations.combinations(
        direction,
        page_sources,
        page_targets,
        (),
        with_qualifier=True,
    )

    qualifiers_map: dict[tuple[str, str], list[str]] = {}
    for _, row in qualifier_combinations.iterrows():
        key = (str(row.iloc[0]), str(row.iloc[1]))
        qualifiers_map.setdefault(key, []).append(str(row.iloc[2]))

    return {pair: sorted(qualifiers) for pair, qualifiers in qualifiers_map.items()}
