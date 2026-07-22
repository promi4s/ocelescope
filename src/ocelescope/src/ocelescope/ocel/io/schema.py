"""Table schemas shared by the OCEL DuckDB importers.

The five tables mirror the flat pm4py representation of an OCEL 2.0 log. Every
table is created with these Arrow types; the readers insert their values as
strings and DuckDB casts them into the column type on insert.
"""

from __future__ import annotations

import duckdb
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
from ocelescope.ocel.constants.tables import OBJECT_CHANGES_TABLE
from ocelescope.util.sql import ident

SchemaDefinition = list[tuple[str, pa.DataType]]

ATTRIBUTE_TYPE_TO_ARROW: dict[str, pa.DataType] = {
    "string": pa.string(),
    "time": pa.timestamp("us", tz="UTC"),
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


def ocel_table_schemas(
    object_columns: SchemaDefinition, event_columns: SchemaDefinition
) -> dict[str, pa.Schema]:
    """The five flat OCEL tables as Arrow schemas.

    ``object_columns`` / ``event_columns`` are the per-log attribute columns to
    append to the fixed base columns of each table.
    """
    return {
        "objects": pa.schema(OBJECT_TABLE_BASE_SCHEMA + object_columns),
        "object_changes": pa.schema(OBJECT_CHANGES_TABLE_SCHEMA + object_columns),
        "o2o": pa.schema(O2O_TABLE_SCHEMA),
        "events": pa.schema(EVENT_TABLE_BASE_SCHEMA + event_columns),
        "e2o": pa.schema(E2O_TABLE_SCHEMA),
    }


def create_ocel_tables(
    con: duckdb.DuckDBPyConnection,
    object_columns: SchemaDefinition,
    event_columns: SchemaDefinition,
) -> dict[str, pa.Schema]:
    """(Re)create the five empty OCEL tables on ``con`` and return their schemas.

    This is the single source of truth for the output layout, shared by every
    importer: :class:`OCELWriter` (JSON/XML) creates the tables here and then
    buffers rows into them, while the SQLite importer creates them here and fills
    them with bulk ``INSERT ... SELECT`` statements. The returned schema dict lets
    callers that buffer rows build one column buffer per table.
    """
    schemas = ocel_table_schemas(object_columns, event_columns)
    for table, schema in schemas.items():
        con.execute(f"DROP TABLE IF EXISTS {ident(table)}")
        con.from_arrow(schema.empty_table()).create(table)
    return schemas


def drop_unchanged_columns(con: duckdb.DuckDBPyConnection) -> None:
    """Drop the ``object_changes`` columns that turned out to hold nothing.

    The tables are created from the log's type declarations, before a single row
    has been read, so ``object_changes`` starts with a column per *declared*
    object attribute. Only the attributes that actually change ever get a value;
    the rest are all-NULL padding, which no reader wants and every exporter has to
    step around. Which is which is only knowable once the table is filled, so the
    importers call this at the end rather than guessing up front.

    One aggregate decides them all -- the table is never materialised to find out.
    """
    meta = (OID_COL, TIMESTAMP_COL)
    names = [
        name
        for name, *_ in con.execute(f"DESCRIBE {ident(OBJECT_CHANGES_TABLE)}").fetchall()
        if name not in meta
    ]
    if not names:
        return

    projection = ", ".join(f"bool_or({ident(name)} IS NOT NULL) AS {ident(name)}" for name in names)
    row = con.execute(f"SELECT {projection} FROM {ident(OBJECT_CHANGES_TABLE)}").fetchall()[0]
    for name, has_values in zip(names, row):
        if not has_values:
            con.execute(f"ALTER TABLE {ident(OBJECT_CHANGES_TABLE)} DROP COLUMN {ident(name)}")


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
