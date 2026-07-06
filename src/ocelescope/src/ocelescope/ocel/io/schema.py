"""Table schemas shared by the OCEL DuckDB importers.

The five tables mirror the flat pm4py representation of an OCEL 2.0 log. Every
table is created with these Arrow types; the readers insert their values as
strings and DuckDB casts them into the column type on insert.
"""

from __future__ import annotations

import pyarrow as pa

from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    E2O_QUALIFIER,
    EID_COL,
    O2O_QUALIFIER,
    O2O_SOURCE_ID,
    O2O_TARGET_ID,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)

#: An ordered list of ``(column_name, arrow_type)`` pairs.
SchemaDefinition = list[tuple[str, pa.DataType]]

#: OCEL 2.0 attribute type -> Arrow type used for the generated columns.
ATTRIBUTE_TYPE_TO_ARROW: dict[str, pa.DataType] = {
    "string": pa.string(),
    "time": pa.date64(),
    "integer": pa.int64(),
    "float": pa.float64(),
    "boolean": pa.bool_(),
}

OBJECT_TABLE_BASE_SCHEMA: SchemaDefinition = [
    (OID_COL, pa.string()),
    (OTYPE_COL, pa.string()),
]

EVENT_TABLE_BASE_SCHEMA: SchemaDefinition = [
    (EID_COL, pa.string()),
    (ACTIVITY_COL, pa.string()),
    (TIMESTAMP_COL, pa.timestamp("us", tz="UTC")),
]

OBJECT_CHANGES_TABLE_SCHEMA: SchemaDefinition = [
    (OID_COL, pa.string()),
    (TIMESTAMP_COL, pa.timestamp("us", tz="UTC")),
]

O2O_TABLE_SCHEMA: SchemaDefinition = [
    (O2O_SOURCE_ID, pa.string()),
    (O2O_QUALIFIER, pa.string()),
    (O2O_TARGET_ID, pa.string()),
]

E2O_TABLE_SCHEMA: SchemaDefinition = [
    (EID_COL, pa.string()),
    (E2O_QUALIFIER, pa.string()),
    (OID_COL, pa.string()),
]


def merge_columns(columns: SchemaDefinition) -> SchemaDefinition:
    """Collapse duplicate attribute names into one column each.

    A flat pm4py table has a single column per attribute name, so an attribute
    declared under several object/event types must resolve to one Arrow type.
    When the declared types disagree we fall back to ``string`` (the universal
    supertype), which also lets any value cast cleanly on insert.
    """
    merged: dict[str, pa.DataType] = {}
    for name, dtype in columns:
        if name in merged and merged[name] != dtype:
            merged[name] = pa.string()
        else:
            merged.setdefault(name, dtype)
    return list(merged.items())
