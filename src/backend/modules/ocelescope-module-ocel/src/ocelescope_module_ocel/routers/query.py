"""Run ad-hoc analytical SQL against an OCEL.

This is the small, general-purpose data seam used by connected frontend
components: they send one query, they get tidy rows back. The request's
``ocel_version`` dependency decides whether the SQL sees the original or the
currently filtered OCEL, just like the module's other inspection routes.

Only a single ``SELECT`` runs. The OCEL's DuckDB connection is writable, so
anything else - ``DELETE``, ``DROP``, ``LOAD`` - would let a query change or
extend the log through what is meant to be a read.
"""

import duckdb
from fastapi import APIRouter, HTTPException
from ocelescope_backend.app.dependencies import ApiOcel

from ocelescope_module_ocel.models.query import (
    SqlColumn,
    SqlQueryRequest,
    SqlQueryResult,
)

router = APIRouter()


def _require_single_select(connection: duckdb.DuckDBPyConnection, sql: str) -> None:
    try:
        statements = connection.extract_statements(sql)
    except duckdb.Error as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    if len(statements) != 1:
        raise HTTPException(
            status_code=400, detail="Send exactly one statement, not a script"
        )
    if statements[0].type != duckdb.StatementType.SELECT:
        raise HTTPException(
            status_code=400, detail="Only SELECT queries can be run against an OCEL"
        )


@router.post(
    "/{ocel_id}/query",
    operation_id="runSqlQuery",
    summary="Run SQL against an OCEL",
)
def run_sql_query(ocel: ApiOcel, request: SqlQueryRequest) -> SqlQueryResult:
    _require_single_select(ocel.con, request.sql)
    try:
        relation = ocel.sql(request.sql, request.parameters)
        names = relation.columns
        types = relation.types
        # One row past the cap tells us the query had more to give.
        records = relation.limit(request.max_rows + 1).fetchall()
    except duckdb.Error as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    truncated = len(records) > request.max_rows
    return SqlQueryResult(
        columns=[
            SqlColumn(name=name, type=str(column_type))
            for name, column_type in zip(names, types, strict=True)
        ],
        rows=[
            dict(zip(names, record, strict=True))
            for record in records[: request.max_rows]
        ],
        truncated=truncated,
    )
