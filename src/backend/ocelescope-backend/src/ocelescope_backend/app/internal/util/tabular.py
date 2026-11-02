from typing import Any

from ocelescope.util.sql import ident

from ocelescope import ResourceBase, TabularResource
from ocelescope_backend.app.internal.exceptions import BadRequest, NotFound
from ocelescope_backend.app.internal.model.base import PaginatedResponse


def as_tabular(resource: ResourceBase) -> TabularResource:
    if not isinstance(resource, TabularResource):
        raise BadRequest("Resource is not tabular.")
    return resource


def _column_names(resource: TabularResource, table_name: str) -> list[str]:
    table = resource.tables.get(table_name)
    if table is None:
        raise NotFound(f"Table {table_name} not found")
    return [
        column_name
        for column_name, _ in [*table.schema, *table.get_extra_columns(resource.con)]
    ]


def query_table(
    resource: TabularResource,
    table_name: str,
    page: int,
    size: int,
    sort_by: str | None = None,
    descending: bool = False,
    filters: dict[str, list[str]] | None = None,
) -> PaginatedResponse[list[dict[str, Any]]]:
    column_names = _column_names(resource, table_name)
    active_filters = {
        column_name: values for column_name, values in (filters or {}).items() if values
    }
    for column_name in [*active_filters, *([sort_by] if sort_by is not None else [])]:
        if column_name not in column_names:
            raise BadRequest(f"Table {table_name} has no column {column_name}")

    where = " AND ".join(
        f"CAST({ident(column_name)} AS VARCHAR) IN ({', '.join('?' * len(values))})"
        for column_name, values in active_filters.items()
    )
    where_clause = f"WHERE {where}" if where else ""
    params = [value for values in active_filters.values() for value in values]

    order = (
        f"{ident(sort_by)} {'DESC' if descending else 'ASC'} NULLS LAST, rowid"
        if sort_by is not None
        else "rowid"
    )
    columns = ", ".join(ident(column_name) for column_name in column_names)
    rows = resource.con.execute(
        f"SELECT {columns} FROM {ident(table_name)} {where_clause} ORDER BY {order} LIMIT ? OFFSET ?",
        [*params, size, (page - 1) * size],
    ).fetchall()
    count = resource.con.execute(
        f"SELECT count(*) FROM {ident(table_name)} {where_clause}", params
    ).fetchone()

    return PaginatedResponse(
        response=[dict(zip(column_names, row, strict=True)) for row in rows],
        page=page,
        page_size=size,
        total_items=int(count[0]) if count else 0,
    )


def column_values(
    resource: TabularResource,
    table_name: str,
    column_name: str,
    page: int,
    size: int,
    search: str | None = None,
) -> PaginatedResponse[list[str]]:
    if column_name not in _column_names(resource, table_name):
        raise NotFound(f"Table {table_name} has no column {column_name}")

    column = ident(column_name)
    search_clause = (
        f"AND contains(lower(CAST({column} AS VARCHAR)), lower(?))" if search else ""
    )
    params = [search] if search else []
    distinct = (
        f"SELECT DISTINCT {column} FROM {ident(table_name)} "
        f"WHERE {column} IS NOT NULL {search_clause}"
    )
    rows = resource.con.execute(
        f"SELECT CAST({column} AS VARCHAR) FROM ({distinct}) ORDER BY {column} LIMIT ? OFFSET ?",
        [*params, size, (page - 1) * size],
    ).fetchall()
    count = resource.con.execute(
        f"SELECT count(*) FROM ({distinct})", params
    ).fetchone()

    return PaginatedResponse(
        response=[row[0] for row in rows],
        page=page,
        page_size=size,
        total_items=int(count[0]) if count else 0,
    )
