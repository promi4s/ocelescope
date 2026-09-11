"""Helpers for talking to DuckDB."""

from __future__ import annotations

import duckdb

__all__ = ["ident", "literal", "set_utc", "utc_timestamp"]


def set_utc(con: duckdb.DuckDBPyConnection) -> None:
    """Put ``con`` -- and any cursor taken from it -- in UTC."""
    con.execute("SET GLOBAL TimeZone='UTC'")
    con.execute("SET TimeZone='UTC'")


def utc_timestamp(expr: str) -> str:
    """Read ``expr`` -- OCEL timestamp text -- as a zone-less UTC timestamp."""
    return f"TRY_CAST({expr} AS TIMESTAMPTZ) AT TIME ZONE 'UTC'"


def ident(name: str) -> str:
    """Quote ``name`` as a SQL identifier.

    Wrapping in double quotes and doubling any embedded quote is the SQL-standard
    way to escape an identifier, and it is what makes ``ocel:activity`` or an
    attribute named ``net price`` usable as a column reference.
    """
    return '"' + name.replace('"', '""') + '"'


def literal(value: str) -> str:
    """Render ``value`` as a SQL string literal, escaping embedded single quotes."""
    return "'" + value.replace("'", "''") + "'"


def first_column_list(relation: duckdb.DuckDBPyRelation):
    return [value[0] for value in relation.fetchall()]
