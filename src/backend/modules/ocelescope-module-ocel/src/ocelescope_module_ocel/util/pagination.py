"""Shared DuckDB helpers for the OCEL routers."""

from __future__ import annotations

import duckdb
from ocelescope_backend.app.internal.model.base import PaginatedResponse


def paginate_ids(
    rel: duckdb.DuckDBPyRelation,
    id_col: str,
    search: str | None,
    page: int,
    size: int,
    order_by: list[str] | None = None,
) -> PaginatedResponse[list[str]]:
    """Search (case-insensitive substring) and paginate a single id column.

    The count, filter and page slice all run inside DuckDB so only the requested
    ``size`` ids are ever materialized (the full column is never pulled into memory).
    ``total_items`` is the *unfiltered* row count (matching the previous behaviour);
    the search only narrows the returned page.

    ``order_by`` columns lead the ordering; ``id_col`` is always appended as a final
    tie-breaker so pagination is deterministic (equal ``order_by`` values -- e.g. tied
    timestamps -- can't otherwise shuffle rows between pages across calls).
    """
    count_row = rel.aggregate("count(*)").fetchone()
    total = int(count_row[0]) if count_row else 0

    query = rel
    if search:
        # Escape single quotes so the literal is injection-safe; ``contains`` is a
        # literal case-insensitive substring match (the documented behaviour).
        escaped = search.replace("'", "''")
        query = query.filter(f"contains(lower(\"{id_col}\"), lower('{escaped}'))")

    order_expr = ", ".join(f'"{column}"' for column in [*(order_by or []), id_col])
    ids: list[str] = [
        row[0]
        for row in query.order(order_expr)
        .limit(size, offset=(page - 1) * size)
        .project(f'"{id_col}"')
        .fetchall()
    ]
    return PaginatedResponse(response=ids, page=page, page_size=size, total_items=total)
