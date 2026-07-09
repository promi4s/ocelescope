"""SQL that reshapes the flat OCEL DuckDB tables into the pm4py frame layout.

Shared by the pandas loader (:mod:`read_duckdb`) and the lazy DuckDB-backed OCEL,
so there is a single definition of how the five flat tables (``events``,
``objects``, ``e2o``, ``o2o``, ``object_changes``) map onto the pm4py columns.

Each builder takes a ``source`` schema prefix so the same SQL can read bare tables
(``events``) on a direct connection or attached ones (``base.events``) on the lazy
instance. All timestamps assume the connection's ``TimeZone`` is set to ``UTC``.
"""

from __future__ import annotations

from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    E2O_QUALIFIER,
    EID_COL,
    O2O_QUALIFIER,
    O2O_SOURCE_ID,
    O2O_TARGET_ID,
    OBJECT_CHANGE_CUMCOUNT,
    OBJECT_CHANGED_FIELD,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)


def events_sql(source: str = "") -> str:
    """Events in timestamp order (already pm4py-shaped in the flat table)."""
    return f'SELECT * FROM {source}events ORDER BY "{TIMESTAMP_COL}"'


def objects_sql(source: str = "") -> str:
    """Objects (already pm4py-shaped in the flat table)."""
    return f"SELECT * FROM {source}objects"


def relations_sql(source: str = "") -> str:
    """E2O relations joined to their event (activity, timestamp) and object type."""
    return (
        f'SELECT r."{EID_COL}", r."{OID_COL}", r."{E2O_QUALIFIER}" AS "{O2O_QUALIFIER}", '
        f'e."{ACTIVITY_COL}", e."{TIMESTAMP_COL}", o."{OTYPE_COL}" '
        f"FROM {source}e2o r "
        f'JOIN {source}events e ON r."{EID_COL}" = e."{EID_COL}" '
        f'JOIN {source}objects o ON r."{OID_COL}" = o."{OID_COL}" '
        f'ORDER BY e."{TIMESTAMP_COL}"'
    )


def o2o_sql(source: str = "") -> str:
    """O2O relations with the source column renamed to ``ocel:oid``."""
    return (
        f'SELECT "{O2O_SOURCE_ID}" AS "{OID_COL}", "{O2O_TARGET_ID}", "{O2O_QUALIFIER}" '
        f"FROM {source}o2o"
    )


def object_changes_sql(attribute_columns: list[str], source: str = "") -> str:
    """Object changes with the recovered ``ocel:type`` / ``ocel:field`` / ``@@cumcount``.

    The flat table is wide with exactly one non-null attribute value per row, so
    ``ocel:field`` is the name of that column and ``@@cumcount`` is the per-object
    change index in timestamp order.
    """
    if attribute_columns:
        field = "CASE " + " ".join(
            f"WHEN c.\"{name}\" IS NOT NULL THEN '{name.replace(chr(39), chr(39) * 2)}'"
            for name in attribute_columns
        ) + " END"
    else:
        field = "NULL"

    return (
        f'SELECT c.*, o."{OTYPE_COL}", {field} AS "{OBJECT_CHANGED_FIELD}", '
        f'row_number() OVER (PARTITION BY c."{OID_COL}" ORDER BY c."{TIMESTAMP_COL}") '
        f'AS "{OBJECT_CHANGE_CUMCOUNT}" '
        f'FROM {source}object_changes c '
        f'JOIN {source}objects o ON c."{OID_COL}" = o."{OID_COL}" '
        f'ORDER BY c."{TIMESTAMP_COL}"'
    )
