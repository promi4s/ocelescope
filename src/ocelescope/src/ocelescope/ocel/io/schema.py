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
    OBJECT_CHANGED_FIELD,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.ocel.constants.quantity import (
    QEL_ITEM_TYPE,
    QEL_QUANTITY,
    QUANTITIES_TABLE,
    QUANTITY_ITEM_PROPERTIES_TABLE,
    QUANTITY_OPERATIONS_TABLE,
)
from ocelescope.util.sql import ident

SchemaDefinition = list[tuple[str, pa.DataType]]

TIMESTAMP_TYPE = pa.timestamp("us")

ATTRIBUTE_TYPE_TO_ARROW: dict[str, pa.DataType] = {
    "string": pa.string(),
    "time": TIMESTAMP_TYPE,
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
    (TIMESTAMP_COL, TIMESTAMP_TYPE),
]


OBJECT_CHANGES_TABLE_SCHEMA: SchemaDefinition = [
    (OID_COL, pa.string()),
    (TIMESTAMP_COL, TIMESTAMP_TYPE),
    (OBJECT_CHANGED_FIELD, pa.string()),
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

QUANTITIES_TABLE_SCHEMA: SchemaDefinition = [
    (OID_COL, pa.string()),
    (QEL_ITEM_TYPE, pa.string()),
    (QEL_QUANTITY, pa.float64()),
]

QUANTITY_OPERATIONS_TABLE_SCHEMA: SchemaDefinition = [
    (EID_COL, pa.string()),
    (OID_COL, pa.string()),
    (QEL_ITEM_TYPE, pa.string()),
    (QEL_QUANTITY, pa.float64()),
]


QUANTITY_ITEM_PROPERTIES_TABLE_SCHEMA: SchemaDefinition = [
    (QEL_ITEM_TYPE, pa.string()),
]


def ocel_table_schemas(
    object_columns: SchemaDefinition, event_columns: SchemaDefinition
) -> dict[str, pa.Schema]:
    """The five flat OCEL tables as Arrow schemas.

    ``object_columns`` / ``event_columns`` are the per-log attribute columns to
    append to the fixed base columns of each table.
    """
    return {
        "objects": pa.schema(OBJECT_TABLE_BASE_SCHEMA),
        "object_changes": pa.schema(OBJECT_CHANGES_TABLE_SCHEMA + object_columns),
        "o2o": pa.schema(O2O_TABLE_SCHEMA),
        "events": pa.schema(EVENT_TABLE_BASE_SCHEMA + event_columns),
        "e2o": pa.schema(E2O_TABLE_SCHEMA),
    }


def _create_if_missing(con: duckdb.DuckDBPyConnection, table: str, schema: pa.Schema) -> None:
    """Create ``table`` from ``schema``, empty, unless ``con`` already has it."""
    if con.execute(
        "SELECT 1 FROM information_schema.tables WHERE table_name = ?", [table]
    ).fetchone():
        return
    con.from_arrow(schema.empty_table()).create(table)


def ensure_quantity_tables(con: duckdb.DuckDBPyConnection) -> None:
    """Create any missing quantity-extension table on ``con``, empty.

    Called for every OCEL, whether or not its log has an extension, so that the
    three tables are as reliably there as the five flat ones: a reader can sum
    ``quantity_operations`` without first proving it exists, and an importer that
    does find an extension replaces these in place. A table that is already there
    is left alone -- this never discards rows, so it is safe to call after the
    extension has been read.
    """

    table_schemas = {
        QUANTITIES_TABLE: pa.schema(QUANTITIES_TABLE_SCHEMA),
        QUANTITY_OPERATIONS_TABLE: pa.schema(QUANTITY_OPERATIONS_TABLE_SCHEMA),
        QUANTITY_ITEM_PROPERTIES_TABLE: pa.schema(QUANTITY_ITEM_PROPERTIES_TABLE_SCHEMA),
    }

    for table, schema in table_schemas.items():
        _create_if_missing(con, table, schema)


def ensure_ocel_tables(con: duckdb.DuckDBPyConnection) -> None:
    """Create any missing OCEL table on ``con``, empty, the quantity ones included.

    The counterpart to :func:`create_ocel_tables` for a database that is not being
    imported into. Every OCEL runs this on construction, so its managers can read
    -- and write -- their own table without each first proving the log has one:
    the eight tables are there from the start, however the database was built.

    A table already present is left alone, its rows and its per-log attribute
    columns with it, so this never discards anything and is safe to call on a log
    that is already loaded.
    """
    for table, schema in ocel_table_schemas([], []).items():
        _create_if_missing(con, table, schema)
    ensure_quantity_tables(con)


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
    ensure_quantity_tables(con)
    return schemas


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
