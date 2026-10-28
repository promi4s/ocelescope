"""Shared DuckDB helpers for the OCEL routers."""

from __future__ import annotations

import duckdb
from ocelescope.util.sql import ident, literal
from ocelescope_backend.app.internal.model.base import PaginatedResponse


def paginate_ids(
    rel: duckdb.DuckDBPyRelation,
    id_col: str,
    search: str | None,
    page: int,
    size: int,
) -> PaginatedResponse[list[str]]:
    """Search (case-insensitive substring) and paginate a single id column."""

    query = rel
    if search:
        query = query.filter(
            f"contains(lower({ident(id_col)}), lower({literal(search)}))"
        )

    count_row = query.aggregate("count(*)").fetchone()
    total = int(count_row[0]) if count_row else 0

    ids: list[str] = [
        row[0]
        for row in query.order(ident(id_col))
        .limit(size, offset=(page - 1) * size)
        .project(ident(id_col))
        .fetchall()
    ]
    return PaginatedResponse(response=ids, page=page, page_size=size, total_items=total)
