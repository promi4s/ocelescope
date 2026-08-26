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
from ocelescope.ocel.constants.tables import (
    E2O_TABLE,
    EVENTS_TABLE,
    O2O_TABLE,
    OBJECT_CHANGES_TABLE,
    OBJECTS_TABLE,
)

SchemaDefinition = list[tuple[str, pa.DataType]]

TIMESTAMP_TYPE = pa.timestamp("us")

ATTRIBUTE_TYPE_TO_ARROW: dict[str, pa.DataType] = {
    "string": pa.string(),
    "time": TIMESTAMP_TYPE,
    "integer": pa.int64(),
    "float": pa.float64(),
    "boolean": pa.bool_(),
}

ATTRIBUTE_TYPE_TO_DUCKDB: dict[str, str] = {
    "string": "VARCHAR",
    "time": "TIMESTAMP",
    "integer": "BIGINT",
    "float": "DOUBLE",
    "boolean": "BOOLEAN",
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


def _duckdb_type(dtype: pa.DataType) -> str:
    """``dtype`` as a DuckDB type name, which a cast can be written with."""
    if dtype == TIMESTAMP_TYPE:
        return "TIMESTAMP"
    if dtype == pa.float64():
        return "DOUBLE"
    return "VARCHAR"


FIXED_COLUMN_TYPES: dict[str, dict[str, str]] = {
    table: {name: _duckdb_type(dtype) for name, dtype in definition}
    for table, definition in {
        OBJECTS_TABLE: OBJECT_TABLE_BASE_SCHEMA,
        OBJECT_CHANGES_TABLE: OBJECT_CHANGES_TABLE_SCHEMA,
        O2O_TABLE: O2O_TABLE_SCHEMA,
        EVENTS_TABLE: EVENT_TABLE_BASE_SCHEMA,
        E2O_TABLE: E2O_TABLE_SCHEMA,
        QUANTITIES_TABLE: QUANTITIES_TABLE_SCHEMA,
        QUANTITY_OPERATIONS_TABLE: QUANTITY_OPERATIONS_TABLE_SCHEMA,
        QUANTITY_ITEM_PROPERTIES_TABLE: QUANTITY_ITEM_PROPERTIES_TABLE_SCHEMA,
    }.items()
}
"""Each table's fixed columns, with the type the schema gives them.

What a table is stored as is the schema's business, not the contents' -- a frame
that arrives empty says nothing about its own types, and DuckDB reads a column of
nothing as INTEGER. The per-log attribute columns are deliberately absent: their
type is the log's to decide.
"""


def ocel_table_schemas(
    object_columns: SchemaDefinition, event_columns: SchemaDefinition
) -> dict[str, pa.Schema]:
    """The five flat OCEL tables as Arrow schemas.

    ``object_columns`` / ``event_columns`` are the per-log attribute columns to
    append to the fixed base columns of each table.
    """
    return {
        OBJECTS_TABLE: pa.schema(OBJECT_TABLE_BASE_SCHEMA),
        OBJECT_CHANGES_TABLE: pa.schema(OBJECT_CHANGES_TABLE_SCHEMA + object_columns),
        O2O_TABLE: pa.schema(O2O_TABLE_SCHEMA),
        EVENTS_TABLE: pa.schema(EVENT_TABLE_BASE_SCHEMA + event_columns),
        E2O_TABLE: pa.schema(E2O_TABLE_SCHEMA),
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
