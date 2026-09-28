"""Read the deprecated XML quantity extension into the quantity tables.

Only for reading old logs: the current format writes the quantity tables as
ordinary ``<table>`` extras, which never reach this module.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any, cast

import duckdb
from lxml import etree

from ocelescope.ocel.constants.pm4py import EID_COL, OID_COL
from ocelescope.ocel.constants.quantity import (
    QEL_ITEM_TYPE,
    QEL_QUANTITY,
    QUANTITIES_TABLE,
    QUANTITY_ITEM_PROPERTIES_TABLE,
    QUANTITY_OPERATIONS_TABLE,
)
from ocelescope.ocel.io.extras.tables import rows_to_arrow
from ocelescope.ocel.io.schema import ATTRIBUTE_TYPE_TO_DUCKDB
from ocelescope.util.sql import ident

XML_QUANTITY_EXTENSION = "quantity-extension"

XML_OPERATION = "operation"
XML_PROPERTIES_TYPE = "item-type"
XML_PROPERTIES_TYPE_NAME = "name"
XML_PROPERTY = "property"
XML_PROPERTY_NAME = "name"
XML_PROPERTY_TYPE = "type"
XML_QUANTITY = "quantity"
XML_EVENT_ID = "event-id"
XML_OBJECT_ID = "object-id"
XML_ITEM = "item"
XML_ITEM_TYPE = "type"
XML_QUANTITY_TYPE = "type"

BATCH_SIZE = 50_000
CHUNK_SIZE = 1 << 24


def _cast(column: str, ocel_type: str) -> str:
    """SQL that turns the text of ``column`` into its OCEL type; a bad value becomes NULL."""
    duckdb_type = ATTRIBUTE_TYPE_TO_DUCKDB.get(ocel_type, "VARCHAR")
    if duckdb_type == "TIMESTAMP":
        # through TIMESTAMPTZ, so an offset like "Z" is applied instead of rejected
        return f"CAST(TRY_CAST({ident(column)} AS TIMESTAMPTZ) AS TIMESTAMP)"
    return f"TRY_CAST({ident(column)} AS {duckdb_type})"


QUANTITY_CAST = {QEL_QUANTITY: _cast(QEL_QUANTITY, "float")}


def _write(
    connection: duckdb.DuckDBPyConnection,
    table_name: str,
    records: list[dict[str, Any]],
    casts: dict[str, str],
    created: set[str],
) -> None:
    """Write records into a quantity table, replacing it with the first batch."""
    arrow_batch = rows_to_arrow(records, table_name)
    select_list = ", ".join(
        f"{casts[column]} AS {ident(column)}" if column in casts else ident(column)
        for column in arrow_batch.column_names
    )
    if table_name in created:
        connection.execute(
            f"INSERT INTO {ident(table_name)} BY NAME SELECT {select_list} FROM arrow_batch"
        )
    else:
        connection.execute(
            f"CREATE OR REPLACE TABLE {ident(table_name)} AS SELECT {select_list} FROM arrow_batch"
        )
        created.add(table_name)
    records.clear()


def _iter_elements(fragment: bytes, tags: tuple[str, ...]) -> Iterator[etree._Element]:
    """Yield the elements named ``tags`` in ``fragment`` one by one, freeing each after use."""
    parser = etree.XMLPullParser(events=("end",), tag=tags, huge_tree=True)
    view = memoryview(fragment)
    for start in range(0, len(view), CHUNK_SIZE):
        parser.feed(bytes(view[start : start + CHUNK_SIZE]))
        for _, element in parser.read_events():
            element = cast(etree._Element, element)
            yield element
            element.clear()
            parent = element.getparent()
            while (
                parent is not None and (previous := element.getprevious()) is not None
            ):
                parent.remove(previous)
    parser.close()


def read_legacy_xml_quantities(
    fragment: bytes, connection: duckdb.DuckDBPyConnection
) -> set[str]:
    """Read the bytes of a ``<quantity-extension>`` element into the quantity tables.

    ``fragment`` is the element from its opening to its closing tag. Returns the
    tables that were filled. An operation with several ``<item>`` children becomes
    one row per item; item properties get the type their ``<property>`` declares.
    """
    operations: list[dict[str, Any]] = []
    quantities: list[dict[str, Any]] = []
    item_types: list[dict[str, Any]] = []
    property_types: dict[str, str] = {}
    created: set[str] = set()

    for element in _iter_elements(
        fragment, (XML_OPERATION, XML_QUANTITY, XML_PROPERTIES_TYPE)
    ):
        if element.tag == XML_OPERATION:
            for item in element.iterchildren(XML_ITEM):
                operations.append(
                    {
                        EID_COL: element.get(XML_EVENT_ID),
                        OID_COL: element.get(XML_OBJECT_ID),
                        QEL_ITEM_TYPE: item.get(XML_ITEM_TYPE),
                        QEL_QUANTITY: item.text,
                    }
                )
            if len(operations) >= BATCH_SIZE:
                _write(
                    connection,
                    QUANTITY_OPERATIONS_TABLE,
                    operations,
                    QUANTITY_CAST,
                    created,
                )
        elif element.tag == XML_QUANTITY:
            quantities.append(
                {
                    OID_COL: element.get(XML_OBJECT_ID),
                    QEL_ITEM_TYPE: element.get(XML_QUANTITY_TYPE),
                    QEL_QUANTITY: element.text,
                }
            )
            if len(quantities) >= BATCH_SIZE:
                _write(connection, QUANTITIES_TABLE, quantities, QUANTITY_CAST, created)
        else:
            record: dict[str, Any] = {
                QEL_ITEM_TYPE: element.get(XML_PROPERTIES_TYPE_NAME)
            }
            for prop in element.iterchildren(XML_PROPERTY):
                name = str(prop.get(XML_PROPERTY_NAME))
                record[name] = prop.text
                if declared := prop.get(XML_PROPERTY_TYPE):
                    property_types.setdefault(name, str(declared))
            item_types.append(record)

    if operations:
        _write(
            connection, QUANTITY_OPERATIONS_TABLE, operations, QUANTITY_CAST, created
        )
    if quantities:
        _write(connection, QUANTITIES_TABLE, quantities, QUANTITY_CAST, created)
    if item_types:
        property_casts = {
            name: _cast(name, ocel_type) for name, ocel_type in property_types.items()
        }
        _write(
            connection,
            QUANTITY_ITEM_PROPERTIES_TABLE,
            item_types,
            property_casts,
            created,
        )
    return created
