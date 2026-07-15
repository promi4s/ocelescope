"""Write the optional quantity extension back out from its DuckDB tables.

The inverse of ``io.quantities``: read the ``quantities`` /
``quantity_operations`` / ``quantity_item_properties`` tables (if present) and
render them in each output format. The extension is small, so the JSON/XML paths
build it in memory and hand it to the streaming writers, while the SQLite path
stays DuckDB-native (``CREATE TABLE ... AS SELECT`` into the attached output).
"""

from __future__ import annotations

import xml.etree.ElementTree as etree

import duckdb

from ocelescope.ocel.constants.pm4py import EID_COL, OID_COL
from ocelescope.ocel.constants.quantity import (
    JSON_KEYMAP,
    JSON_OPERATIONS,
    JSON_PROPERTIES,
    JSON_QUANTITIES,
    QEL_ITEM_TYPE,
    QEL_QUANTITY,
    QUANTITIES_TABLE,
    QUANTITY_ITEM_PROPERTIES_TABLE,
    QUANTITY_OPERATIONS_TABLE,
    SQL_ITEM_PROPERTIES,
    SQL_KEYMAP,
    SQL_OPERATIONS,
    SQL_QUANTITIES,
    XML_EVENT_ID,
    XML_ITEM,
    XML_ITEM_TYPE,
    XML_OBJECT_ID,
    XML_OPERATION,
    XML_OPERATIONS,
    XML_PROPERTIES,
    XML_PROPERTIES_TYPE,
    XML_PROPERTIES_TYPE_NAME,
    XML_PROPERTY,
    XML_PROPERTY_NAME,
    XML_PROPERTY_TYPE,
    XML_QUANTITIES,
    XML_QUANTITY,
    XML_QUANTITY_EXTENSION,
    XML_QUANTITY_TYPE,
)
from ocelescope.ocel.io.exporters.common import table_exists


def has_quantities(con: duckdb.DuckDBPyConnection) -> bool:
    """Whether any quantity-extension table is present in the DuckDB."""
    return any(
        table_exists(con, table)
        for table in (
            QUANTITIES_TABLE,
            QUANTITY_OPERATIONS_TABLE,
            QUANTITY_ITEM_PROPERTIES_TABLE,
        )
    )


def _fetch_dicts(con: duckdb.DuckDBPyConnection, sql: str) -> list[dict]:
    """Run ``sql`` and return its rows as dicts keyed by the selected column names."""
    result = con.execute(sql)
    names = [description[0] for description in result.description]
    return [dict(zip(names, row)) for row in result.fetchall()]


def _property_columns(con: duckdb.DuckDBPyConnection) -> list[str]:
    return [
        description[0]
        for description in con.execute(
            f'SELECT * FROM "{QUANTITY_ITEM_PROPERTIES_TABLE}" LIMIT 0'
        ).description
    ]


# ---------------------------------------------------------------------------
# JSON
# ---------------------------------------------------------------------------
def json_quantity_extension(con: duckdb.DuckDBPyConnection) -> dict | None:
    """The ``quantityExtension`` object for a JSON log, or ``None`` if empty."""
    quantities: list[dict] = []
    if table_exists(con, QUANTITIES_TABLE):
        quantities = _fetch_dicts(
            con,
            f'SELECT "{OID_COL}" AS "{JSON_KEYMAP[OID_COL]}", '
            f'"{QEL_ITEM_TYPE}" AS "{JSON_KEYMAP[QEL_ITEM_TYPE]}", '
            f'"{QEL_QUANTITY}" AS "{JSON_KEYMAP[QEL_QUANTITY]}" FROM "{QUANTITIES_TABLE}"',
        )

    operations: list[dict] = []
    if table_exists(con, QUANTITY_OPERATIONS_TABLE):
        operations = _fetch_dicts(
            con,
            f'SELECT "{EID_COL}" AS "{JSON_KEYMAP[EID_COL]}", '
            f'"{OID_COL}" AS "{JSON_KEYMAP[OID_COL]}", '
            f'"{QEL_ITEM_TYPE}" AS "{JSON_KEYMAP[QEL_ITEM_TYPE]}", '
            f'"{QEL_QUANTITY}" AS "{JSON_KEYMAP[QEL_QUANTITY]}" FROM "{QUANTITY_OPERATIONS_TABLE}"',
        )

    item_types: list[dict] = []
    if table_exists(con, QUANTITY_ITEM_PROPERTIES_TABLE):
        type_column = JSON_KEYMAP[QEL_ITEM_TYPE]
        projection = ", ".join(
            f'"{column}" AS "{type_column}"' if column == QEL_ITEM_TYPE else f'"{column}"'
            for column in _property_columns(con)
        )
        item_types = _fetch_dicts(
            con, f'SELECT {projection} FROM "{QUANTITY_ITEM_PROPERTIES_TABLE}"'
        )

    if not (quantities or operations or item_types):
        return None

    return {
        JSON_QUANTITIES: quantities,
        JSON_OPERATIONS: operations,
        JSON_PROPERTIES: item_types,
    }


# ---------------------------------------------------------------------------
# XML
# ---------------------------------------------------------------------------
def _xml_text(value: object) -> str:
    return "" if value is None else str(value)


def xml_quantity_extension(con: duckdb.DuckDBPyConnection) -> etree.Element | None:
    """The ``<quantity-extension>`` element for an XML log, or ``None`` if empty."""
    if not has_quantities(con):
        return None

    root = etree.Element(XML_QUANTITY_EXTENSION)

    operations = etree.SubElement(root, XML_OPERATIONS)
    if table_exists(con, QUANTITY_OPERATIONS_TABLE):
        for row in _fetch_dicts(
            con,
            f'SELECT "{EID_COL}", "{OID_COL}", "{QEL_ITEM_TYPE}", "{QEL_QUANTITY}" '
            f'FROM "{QUANTITY_OPERATIONS_TABLE}"',
        ):
            operation = etree.SubElement(
                operations,
                XML_OPERATION,
                {XML_EVENT_ID: _xml_text(row[EID_COL]), XML_OBJECT_ID: _xml_text(row[OID_COL])},
            )
            item = etree.SubElement(
                operation, XML_ITEM, {XML_ITEM_TYPE: _xml_text(row[QEL_ITEM_TYPE])}
            )
            item.text = _xml_text(row[QEL_QUANTITY])

    quantities = etree.SubElement(root, XML_QUANTITIES)
    if table_exists(con, QUANTITIES_TABLE):
        for row in _fetch_dicts(
            con,
            f'SELECT "{OID_COL}", "{QEL_ITEM_TYPE}", "{QEL_QUANTITY}" FROM "{QUANTITIES_TABLE}"',
        ):
            quantity = etree.SubElement(
                quantities,
                XML_QUANTITY,
                {
                    XML_OBJECT_ID: _xml_text(row[OID_COL]),
                    XML_QUANTITY_TYPE: _xml_text(row[QEL_ITEM_TYPE]),
                },
            )
            quantity.text = _xml_text(row[QEL_QUANTITY])

    item_properties = etree.SubElement(root, XML_PROPERTIES)
    if table_exists(con, QUANTITY_ITEM_PROPERTIES_TABLE):
        property_columns = [c for c in _property_columns(con) if c != QEL_ITEM_TYPE]
        for row in _fetch_dicts(con, f'SELECT * FROM "{QUANTITY_ITEM_PROPERTIES_TABLE}"'):
            item_type = etree.SubElement(
                item_properties,
                XML_PROPERTIES_TYPE,
                {XML_PROPERTIES_TYPE_NAME: _xml_text(row[QEL_ITEM_TYPE])},
            )
            for column in property_columns:
                if row[column] is None:
                    continue
                property_element = etree.SubElement(
                    item_type,
                    XML_PROPERTY,
                    {XML_PROPERTY_NAME: column, XML_PROPERTY_TYPE: "string"},
                )
                property_element.text = _xml_text(row[column])

    return root


# ---------------------------------------------------------------------------
# SQLite
# ---------------------------------------------------------------------------
def export_quantities_sqlite(con: duckdb.DuckDBPyConnection) -> None:
    """Copy the quantity-extension tables into the attached ``out`` SQLite database.

    Requires the target to already be attached as ``out``. Each copy is a single
    streamed ``CREATE TABLE ... AS SELECT`` renaming columns back to the OCEL 2.0
    SQLite names.
    """
    if table_exists(con, QUANTITIES_TABLE):
        con.execute(
            f'CREATE TABLE out."{SQL_QUANTITIES}" AS SELECT '
            f'"{OID_COL}" AS "{SQL_KEYMAP[OID_COL]}", '
            f'"{QEL_ITEM_TYPE}" AS "{SQL_KEYMAP[QEL_ITEM_TYPE]}", '
            f'"{QEL_QUANTITY}" AS "{SQL_KEYMAP[QEL_QUANTITY]}" FROM "{QUANTITIES_TABLE}"'
        )

    if table_exists(con, QUANTITY_OPERATIONS_TABLE):
        con.execute(
            f'CREATE TABLE out."{SQL_OPERATIONS}" AS SELECT '
            f'"{EID_COL}" AS "{SQL_KEYMAP[EID_COL]}", '
            f'"{OID_COL}" AS "{SQL_KEYMAP[OID_COL]}", '
            f'"{QEL_ITEM_TYPE}" AS "{SQL_KEYMAP[QEL_ITEM_TYPE]}", '
            f'"{QEL_QUANTITY}" AS "{SQL_KEYMAP[QEL_QUANTITY]}" FROM "{QUANTITY_OPERATIONS_TABLE}"'
        )

    if table_exists(con, QUANTITY_ITEM_PROPERTIES_TABLE):
        type_column = SQL_KEYMAP[QEL_ITEM_TYPE]
        projection = ", ".join(
            f'"{column}" AS "{type_column}"' if column == QEL_ITEM_TYPE else f'"{column}"'
            for column in _property_columns(con)
        )
        con.execute(
            f'CREATE TABLE out."{SQL_ITEM_PROPERTIES}" AS '
            f'SELECT {projection} FROM "{QUANTITY_ITEM_PROPERTIES_TABLE}"'
        )
