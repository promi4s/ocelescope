"""Paging helpers for the OCEL routers."""

from __future__ import annotations

from typing import TypeVar

import duckdb
from ocelescope.util.sql import ident, literal
from ocelescope_backend.app.internal.model.base import PaginatedResponse

T = TypeVar("T")


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


def paginate_list(
    items: list[T], page: int | None, page_size: int | None
) -> PaginatedResponse[list[T]]:
    """Slice an already ordered list; omitting both returns one page with every item."""
    page = page or 1
    page_size = page_size or len(items) or 1
    start = (page - 1) * page_size
    return PaginatedResponse(
        response=items[start : start + page_size],
        page=page,
        page_size=page_size,
        total_items=len(items),
    )
