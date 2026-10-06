"""Read the deprecated quantity extension tables of a SQLite OCEL log.

Reading needs nothing of its own: the three tables are copied like any extra
table (:func:`~ocelescope.ocel.io.extras.sqlite.import_extras_sqlite`, which also
recovers their declared types), and :func:`quantities_from_extras` then only
renames them -- the table, and the columns a SQLite log spells differently. This
table layout is deprecated, so converting it warns.
"""

from __future__ import annotations

import warnings

import duckdb

from ocelescope.ocel.constants.pm4py import EID_COL, OID_COL
from ocelescope.ocel.constants.quantity import (
    QEL_ITEM_TYPE,
    QEL_QUANTITY,
    QUANTITIES_TABLE,
    QUANTITY_ITEM_PROPERTIES_TABLE,
    QUANTITY_OPERATIONS_TABLE,
)
from ocelescope.ocel.io.connection import DuckDBTarget, connect_target
from ocelescope.ocel.io.extras.quantities.util import quantity_as_double
from ocelescope.util.sql import ident

#: Names of the deprecated quantity-extension tables in an OCEL 2.0 SQLite log.
SQL_OPERATIONS = "operation"
SQL_QUANTITIES = "quantity"
SQL_ITEM_PROPERTIES = "itemProperties"

SQL_KEYMAP = {
    EID_COL: "ocel_event_id",
    OID_COL: "ocel_object_id",
    QEL_ITEM_TYPE: "type",
    QEL_QUANTITY: "quantity",
}
"""Our column name -> the column a SQLite log spells it with."""

SQL_TABLES = {
    SQL_QUANTITIES: QUANTITIES_TABLE,
    SQL_OPERATIONS: QUANTITY_OPERATIONS_TABLE,
    SQL_ITEM_PROPERTIES: QUANTITY_ITEM_PROPERTIES_TABLE,
}
"""A SQLite log's extension table -> the table it becomes."""

SQL_RENAMED_COLUMNS = {
    SQL_QUANTITIES: [OID_COL, QEL_ITEM_TYPE, QEL_QUANTITY],
    SQL_OPERATIONS: [EID_COL, OID_COL, QEL_ITEM_TYPE, QEL_QUANTITY],
    SQL_ITEM_PROPERTIES: [QEL_ITEM_TYPE],
}
"""The columns of each table that are renamed from their :data:`SQL_KEYMAP` spelling.

Only these: an item property keeps its name, even one called ``quantity``.
"""


def _legacy_tables(con: duckdb.DuckDBPyConnection) -> list[str]:
    """The legacy extension tables in ``con`` under their SQLite names.

    Only a table that has every column :data:`SQL_RENAMED_COLUMNS` renames counts;
    any other table that happens to be called ``quantity`` stays an extra.
    """
    columns: dict[str, set[str]] = {}
    for table, column in con.execute("""
        SELECT table_name, column_name FROM duckdb_columns()
        WHERE database_name = current_database() AND schema_name = current_schema()
    """).fetchall():
        columns.setdefault(table, set()).add(column)
    return [
        sql_table
        for sql_table in SQL_TABLES
        if sql_table in columns
        and {SQL_KEYMAP[column] for column in SQL_RENAMED_COLUMNS[sql_table]}
        <= columns[sql_table]
    ]


def quantities_from_extras(target: DuckDBTarget) -> None:
    """Turn the legacy quantity tables an extras import copied into the quantity tables.

    :func:`~ocelescope.ocel.io.extras.sqlite.copy_tables` calls this after it
    copied ``operation``, ``quantity`` or ``itemProperties`` like any other extra
    table. Each is renamed in place -- the table to ours, its
    :data:`SQL_RENAMED_COLUMNS` to ours -- so no row is copied again. A table the
    log did not have is left alone.

    Emits a :class:`DeprecationWarning` when there is anything to convert.
    """
    with connect_target(target) as con:
        legacy = _legacy_tables(con)
        if not legacy:
            return

        warnings.warn(
            "The SQLite quantity extension tables "
            f"({', '.join(repr(table) for table in legacy)}) are deprecated. "
            "They were read as extra tables and converted to "
            f"{', '.join(repr(SQL_TABLES[table]) for table in legacy)}.",
            DeprecationWarning,
            stacklevel=2,
        )

        for sql_table in legacy:
            table = SQL_TABLES[sql_table]
            con.execute(f"DROP TABLE IF EXISTS {ident(table)}")
            con.execute(f"ALTER TABLE {ident(sql_table)} RENAME TO {ident(table)}")
            for column in SQL_RENAMED_COLUMNS[sql_table]:
                con.execute(
                    f"ALTER TABLE {ident(table)} "
                    f"RENAME COLUMN {ident(SQL_KEYMAP[column])} TO {ident(column)}"
                )
            quantity_as_double(con, table)
