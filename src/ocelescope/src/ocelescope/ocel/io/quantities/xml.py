import io
import mmap
import os
from pathlib import Path

import duckdb
import pandas as pd
import pyarrow as pa
from lxml import etree

from ocelescope.ocel.constants.pm4py import EID_COL, OID_COL
from ocelescope.ocel.constants.quantity import (
    QEL_ITEM_TYPE,
    QEL_QUANTITY,
    QUANTITIES_TABLE,
    QUANTITY_ITEM_PROPERTIES_TABLE,
    QUANTITY_OPERATIONS_TABLE,
)
from ocelescope.ocel.io.connection import DuckDBTarget, connect_target
from ocelescope.ocel.io.quantities.util import fetch_dicts, write_quantity_frames
from ocelescope.ocel.io.schema import ATTRIBUTE_TYPE_TO_ARROW, TIMESTAMP_TYPE
from ocelescope.util.sql import ident

XML_QUANTITY_EXTENSION = "quantity-extension"

XML_OPERATIONS = "operations"
XML_OPERATION = "operation"
XML_PROPERTIES = "item-properties"
XML_PROPERTIES_TYPE = "item-type"
XML_PROPERTIES_TYPE_NAME = "name"
XML_PROPERTY = "property"
XML_PROPERTY_NAME = "name"
XML_PROPERTY_TYPE = "type"
XML_QUANTITIES = "quantities"
XML_QUANTITY = "quantity"
XML_EVENT_ID = "event-id"
XML_OBJECT_ID = "object-id"
XML_ITEM = "item"
XML_ITEM_TYPE = "type"
XML_QUANTITY_TYPE = "type"


def _cast_properties(df: pd.DataFrame, property_type: dict[str, str]) -> pd.DataFrame:
    """Cast item-property columns to the OCEL types the source declared.

    The properties are parsed as text, so without this a ``float`` property would
    be stored as a string. Anything that will not convert is left as NULL rather
    than failing the import, matching how attribute values are read.
    """
    if not property_type:
        return df
    for column, declared in property_type.items():
        if column not in df.columns:
            continue
        arrow_type = ATTRIBUTE_TYPE_TO_ARROW.get(declared)
        if arrow_type is None or arrow_type == pa.string():
            continue
        if arrow_type == pa.bool_():
            df[column] = (
                df[column]
                .map({"true": True, "True": True, "false": False, "False": False})
                .astype("boolean")
            )
        elif arrow_type == TIMESTAMP_TYPE:
            df[column] = pd.to_datetime(df[column], errors="coerce", utc=True).dt.tz_localize(None)
        elif arrow_type == pa.int64():
            df[column] = pd.to_numeric(df[column], errors="coerce").astype("Int64")
        else:
            df[column] = pd.to_numeric(df[column], errors="coerce").astype("float64")
    return df


def _xml_extension_fragment(source: Path) -> bytes | None:
    """Return the ``<quantity-extension>`` element's bytes, or ``None`` if absent.

    The extension is appended after the log body, so scanning for the open/close
    markers and slicing between them yields just that subtree -- the rest of the
    (possibly huge) file is paged in by ``mmap`` but never copied into RAM.
    """
    if source.stat().st_size == 0:
        return None

    open_marker = f"<{XML_QUANTITY_EXTENSION}".encode()
    close_marker = f"</{XML_QUANTITY_EXTENSION}>".encode()
    with open(source, "rb") as f, mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as mm:
        start = mm.find(open_marker)
        if start == -1:
            return None
        end = mm.find(close_marker, start)
        if end == -1:
            return None
        return mm[start : end + len(close_marker)]


def import_quantities_xml(source: str | Path, target: DuckDBTarget) -> None:
    """Add the quantity-extension tables from an XML log to the DuckDB at ``target``.

    Only the ``<quantity-extension>`` subtree is sliced out and parsed, so the
    log body never has to be materialised. Nothing happens when it is absent.
    """
    fragment = _xml_extension_fragment(Path(source))
    if fragment is None:
        return

    quantity_ext = etree.fromstring(fragment)

    operations_data: list[dict] = []
    operations_elem = quantity_ext.find(XML_OPERATIONS)
    if operations_elem is not None:
        for op in operations_elem.findall(XML_OPERATION):
            item_elem = op.find(XML_ITEM)
            if item_elem is not None:
                operations_data.append(
                    {
                        EID_COL: op.attrib.get(XML_EVENT_ID, ""),
                        OID_COL: op.attrib.get(XML_OBJECT_ID, ""),
                        QEL_ITEM_TYPE: item_elem.attrib.get(XML_ITEM_TYPE, ""),
                        QEL_QUANTITY: float(item_elem.text or ""),
                    }
                )

    quantities_data: list[dict] = []
    quantities_elem = quantity_ext.find(XML_QUANTITIES)
    if quantities_elem is not None:
        for q in quantities_elem.findall(XML_QUANTITY):
            quantities_data.append(
                {
                    OID_COL: q.attrib.get(XML_OBJECT_ID, ""),
                    QEL_ITEM_TYPE: q.attrib.get(XML_QUANTITY_TYPE, ""),
                    QEL_QUANTITY: float(q.text or ""),
                }
            )

    item_property_data: list[dict] = []

    property_type: dict[str, str] = {}
    property_tree = quantity_ext.find(XML_PROPERTIES)
    if property_tree is not None:
        for item_type in property_tree.findall(XML_PROPERTIES_TYPE):
            for prop in item_type.findall(XML_PROPERTY):
                declared = prop.attrib.get(XML_PROPERTY_TYPE)
                if declared:
                    property_type.setdefault(prop.attrib[XML_PROPERTY_NAME], declared)
            item_property_data.append(
                {
                    QEL_ITEM_TYPE: item_type.attrib[XML_PROPERTIES_TYPE_NAME],
                    **{
                        prop.attrib[XML_PROPERTY_NAME]: prop.text
                        for prop in item_type.findall(XML_PROPERTY)
                    },
                }
            )

    if not (operations_data or quantities_data or item_property_data):
        return

    oqty = pd.DataFrame(quantities_data, columns=[OID_COL, QEL_ITEM_TYPE, QEL_QUANTITY])
    qop = pd.DataFrame(operations_data, columns=[EID_COL, OID_COL, QEL_ITEM_TYPE, QEL_QUANTITY])
    item_properties = (
        pd.DataFrame(item_property_data)
        if item_property_data
        else pd.DataFrame(columns=[QEL_ITEM_TYPE])
    )
    item_properties = _cast_properties(item_properties, property_type)

    with connect_target(target) as con:
        write_quantity_frames(con, oqty, qop, item_properties)


def _ocel_type(duckdb_type: str) -> str:
    """Map a DuckDB column type to the OCEL 2.0 attribute type string for it.

    The inverse of :data:`ATTRIBUTE_TYPE_TO_ARROW`; unknown types fall back to
    ``string`` (the universal supertype the importer also uses on clashes).
    """
    t = duckdb_type.upper()
    if "BOOL" in t:
        return "boolean"
    if "TIMESTAMP" in t or "DATE" in t or t == "TIME":
        return "time"
    if "INT" in t:  # TINYINT/SMALLINT/INTEGER/BIGINT/HUGEINT/UINTEGER...
        return "integer"
    if any(kind in t for kind in ("DOUBLE", "FLOAT", "DECIMAL", "REAL", "NUMERIC")):
        return "float"
    return "string"


def _property_types(con: duckdb.DuckDBPyConnection) -> dict[str, str]:
    """Each item-property column with its OCEL type, in the table's column order.

    The item type names the row rather than being a property of it, so it is left
    out -- what remains is exactly what the ``<property>`` elements are written
    from, names and declared types both.
    """
    return {
        name: _ocel_type(dtype)
        for name, dtype, *_ in con.execute(
            f"DESCRIBE {ident(QUANTITY_ITEM_PROPERTIES_TABLE)}"
        ).fetchall()
        if name != QEL_ITEM_TYPE
    }


def _xml_text(value: object) -> str:
    return "" if value is None else str(value)


def xml_quantity_extension(con: duckdb.DuckDBPyConnection):
    """The ``<quantity-extension>`` element for an XML log, or ``None`` if empty."""

    root = etree.Element(XML_QUANTITY_EXTENSION)

    operations = etree.SubElement(root, XML_OPERATIONS)
    for row in fetch_dicts(
        con,
        f'SELECT "{EID_COL}", "{OID_COL}", "{QEL_ITEM_TYPE}", "{QEL_QUANTITY}" '
        f'FROM "{QUANTITY_OPERATIONS_TABLE}"',
    ):
        operation = etree.SubElement(
            operations,
            XML_OPERATION,
            {XML_EVENT_ID: _xml_text(row[EID_COL]), XML_OBJECT_ID: _xml_text(row[OID_COL])},
        )
        item = etree.SubElement(operation, XML_ITEM, {XML_ITEM_TYPE: _xml_text(row[QEL_ITEM_TYPE])})
        item.text = _xml_text(row[QEL_QUANTITY])

    quantities = etree.SubElement(root, XML_QUANTITIES)
    for row in fetch_dicts(
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
    property_type = _property_types(con)

    for row in fetch_dicts(con, f'SELECT * FROM "{QUANTITY_ITEM_PROPERTIES_TABLE}"'):
        item_type = etree.SubElement(
            item_properties,
            XML_PROPERTIES_TYPE,
            {XML_PROPERTIES_TYPE_NAME: _xml_text(row[QEL_ITEM_TYPE])},
        )
        for column in property_type:
            if row[column] is None:
                continue
            property_element = etree.SubElement(
                item_type,
                XML_PROPERTY,
                {
                    XML_PROPERTY_NAME: column,
                    XML_PROPERTY_TYPE: property_type[column],
                },
            )
            property_element.text = _xml_text(row[column])

    return root


_CHUNK = 8192
"""How much of the tail to read at a time when looking for the closing tag."""


def _rfind(stream: io.BufferedRandom, needle: bytes, before: int) -> int:
    """The position of the last ``needle`` before ``before``, searching backwards.

    Read backwards a window at a time so a log that ends in a long run of text
    still only pages in what it has to. ``needle`` is a single byte, so nothing
    can straddle two windows.
    """
    end = before
    while end > 0:
        start = max(0, end - _CHUNK)
        stream.seek(start)
        found = stream.read(end - start).rfind(needle)
        if found != -1:
            return start + found
        end = start
    raise ValueError(f"no {needle!r} in the file")


def _append_child(target: str | Path, element: etree._Element) -> None:
    """Write ``element`` in as the last child of an XML document's root, in place.

    The counterpart of :func:`_xml_extension_fragment`, and the same bargain: the
    log is neither parsed nor copied. A document ends with its root's closing tag,
    so the last ``<`` in the file opens that tag -- everything from there is held
    aside, the file is truncated, and the element is written in the gap before the
    closing tag goes back on. The cost is the size of the element, not the log's.
    """
    payload = etree.tostring(element)

    with open(target, "r+b") as stream:
        stream.seek(0, os.SEEK_END)
        closing_tag = _rfind(stream, b"<", stream.tell())

        stream.seek(closing_tag)
        closing = stream.read()
        if not closing.startswith(b"</"):
            raise ValueError(f"{target} does not end in a closing tag")

        stream.seek(closing_tag)
        stream.truncate()
        stream.write(payload)
        stream.write(closing)


def export_quantities_xml(con: duckdb.DuckDBPyConnection, target: str | Path) -> None:
    """Add the ``<quantity-extension>`` element to the XML log at ``target``.

    The log is written by r4pm, which knows nothing of the extension, so this
    appends it afterwards -- as the root's last child, which is where
    :func:`import_quantities_xml` looks for it. A log whose three tables are all
    empty is left exactly as it was.
    """
    extension = xml_quantity_extension(con)
    if all(len(child) == 0 for child in extension):
        return

    _append_child(target, extension)
