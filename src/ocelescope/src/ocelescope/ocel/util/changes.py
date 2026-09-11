"""Shaping the object_changes table, shared by the importers and the managers."""

from __future__ import annotations

import duckdb

from ocelescope.ocel.constants.pm4py import OBJECT_CHANGED_FIELD, OID_COL, TIMESTAMP_COL
from ocelescope.ocel.constants.tables import OBJECT_CHANGES_TABLE
from ocelescope.util.sql import ident


def collapse_object_changes(con: duckdb.DuckDBPyConnection) -> None:
    """Collapse ``object_changes`` onto one row per object, attribute and timestamp.

    An attribute holds one value at one moment, so rows agreeing on all three are
    the same change written twice -- and real files do carry them, a type table
    listing the same change once per row it touches.

    ``max`` is what collapses a group: it skips NULLs, and every column of a
    change row but the attribute's own is NULL, so the group keeps the one value
    it holds. Two rows that disagree resolve to the larger value rather than to
    whichever DuckDB read first.
    """
    oid, ts = ident(OID_COL), ident(TIMESTAMP_COL)
    field = ident(OBJECT_CHANGED_FIELD)

    columns = [row[0] for row in con.execute(f"DESCRIBE {ident(OBJECT_CHANGES_TABLE)}").fetchall()]
    attributes = [
        name for name in columns if name not in (OID_COL, TIMESTAMP_COL, OBJECT_CHANGED_FIELD)
    ]
    values = f", max(COLUMNS(* EXCLUDE ({oid}, {ts}, {field})))" if attributes else ""

    con.execute(
        f"CREATE OR REPLACE TABLE {OBJECT_CHANGES_TABLE} AS "
        f"SELECT {oid}, {ts}, {field}{values} FROM {OBJECT_CHANGES_TABLE} "
        f"GROUP BY {oid}, {ts}, {field}"
    )
