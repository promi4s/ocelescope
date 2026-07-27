"""Stream the optional OCEL 2.0 quantity extension into the DuckDB output.

When a log carries a quantity extension the importers add three more tables to
the DuckDB database next to the five flat OCEL tables:

* ``quantities``               -- initial quantity per (object, item type)
* ``quantity_operations``      -- quantity change per (event, object, item type)
* ``quantity_item_properties`` -- one row per item type plus its property columns

The extension is optional and, when present, small relative to the log body, so
these helpers never materialise the whole log to reach it: JSON is read
incrementally with ``ijson`` and only the extension sub-object is built, XML is
sliced out by byte offset and parsed on its own, and the SQLite importer copies
the extension tables straight across the already-attached source with streamed
``INSERT ... SELECT`` statements. If a file has no extension, no tables are added.
"""

from __future__ import annotations

import mmap
import xml.etree.ElementTree as etree
from pathlib import Path
from typing import Any, cast

import duckdb
import ijson
import pandas as pd
import pyarrow as pa

from ocelescope.ocel.constants.pm4py import EID_COL, OID_COL
from ocelescope.ocel.constants.quantity import (
    JSON_KEYMAP,
    JSON_OPERATIONS,
    JSON_PROPERTIES,
    JSON_QUANTITIES,
    JSON_QUANTITY_EXTENSION,
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
    inverse_keymap,
)
from ocelescope.ocel.io.connection import DuckDBTarget, connect_target
from ocelescope.ocel.io.schema import ATTRIBUTE_TYPE_TO_ARROW, TIMESTAMP_TYPE


def import_quantities(source: str | Path, target: DuckDBTarget) -> None:
    """Add a log's quantity-extension tables to ``target``, dispatching on extension.

    For a reader that only brings in the log body -- r4pm's, say -- this is how the
    extension is added alongside it. SQLite is absent on purpose: its extension
    tables are copied by :func:`import_quantities_sqlite` from within the SQLite
    importer, which already has the source attached to read them through.
    """
    match Path(source).suffix:
        case ".xmlocel" | ".xml":
            import_quantities_xml(source, target)
        case ".jsonocel" | ".json":
            import_quantities_json(source, target)
        case suffix:
            raise ValueError(f"Unsupported extension: {suffix}")


def _as_float(values: Any) -> pd.Series:
    """A quantity column as floats, with anything non-numeric turned into NaN."""
    return cast(pd.Series, pd.to_numeric(values, errors="coerce")).astype("float64")


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


def _write_table(con: duckdb.DuckDBPyConnection, name: str, df: pd.DataFrame) -> None:
    """(Re)create ``name`` on ``con`` from a DataFrame, preserving its columns.

    Registering the frame lets DuckDB read it directly and infer the column
    types; column names carrying colons (e.g. ``qel:quantity``) survive because
    ``SELECT *`` copies them verbatim.
    """
    con.execute(f'DROP TABLE IF EXISTS "{name}"')
    con.register("_quantity_source", df)
    try:
        con.execute(f'CREATE TABLE "{name}" AS SELECT * FROM _quantity_source')
    finally:
        con.unregister("_quantity_source")


def _write_quantity_frames(
    con: duckdb.DuckDBPyConnection,
    oqty: pd.DataFrame,
    qop: pd.DataFrame,
    item_properties: pd.DataFrame,
) -> None:
    """Persist the three extension frames as DuckDB tables.

    ``quantity`` columns are coerced to floats so numeric text (or ``Decimal``
    from a JSON parse) lands in a numeric column -- a log that writes quantities
    as text would otherwise poison every later comparison and sum. ``float`` (not
    whatever ``to_numeric`` infers) so that a log with whole-number quantities
    still gets the same column type as one with fractional ones, matching the
    ``DOUBLE`` the SQLite importer and the quantity setters store. Item-property
    values keep the types the parser produced.
    """
    oqty[QEL_QUANTITY] = _as_float(oqty[QEL_QUANTITY])
    qop[QEL_QUANTITY] = _as_float(qop[QEL_QUANTITY])

    _write_table(con, QUANTITIES_TABLE, oqty)
    _write_table(con, QUANTITY_OPERATIONS_TABLE, qop)
    _write_table(con, QUANTITY_ITEM_PROPERTIES_TABLE, item_properties)


# ---------------------------------------------------------------------------
# JSON
# ---------------------------------------------------------------------------
def import_quantities_json(source: str | Path, target: DuckDBTarget) -> None:
    """Add the quantity-extension tables from a JSON log to the DuckDB at ``target``.

    ``ijson.kvitems`` streams the top-level ``quantityExtension`` object, so the
    (potentially multi-GB) log body is never held in memory -- only the small
    extension arrays are built. Nothing happens when the key is absent.
    """
    oqty_records: list = []
    qop_records: list = []
    property_records: list = []

    with open(source, "rb") as f:
        for key, value in ijson.kvitems(f, JSON_QUANTITY_EXTENSION, use_float=True):
            if key == JSON_QUANTITIES:
                oqty_records = value
            elif key == JSON_OPERATIONS:
                qop_records = value
            elif key == JSON_PROPERTIES:
                property_records = value

    if not (oqty_records or qop_records or property_records):
        return

    rename = inverse_keymap(JSON_KEYMAP)
    oqty = pd.DataFrame.from_records(
        oqty_records,
        columns=[JSON_KEYMAP[OID_COL], JSON_KEYMAP[QEL_ITEM_TYPE], JSON_KEYMAP[QEL_QUANTITY]],
    ).rename(columns=rename)
    qop = pd.DataFrame.from_records(
        qop_records,
        columns=[
            JSON_KEYMAP[EID_COL],
            JSON_KEYMAP[OID_COL],
            JSON_KEYMAP[QEL_ITEM_TYPE],
            JSON_KEYMAP[QEL_QUANTITY],
        ],
    ).rename(columns=rename)
    item_properties = (
        pd.DataFrame.from_records(property_records).rename(columns=rename)
        if property_records
        else pd.DataFrame(columns=[QEL_ITEM_TYPE])
    )

    with connect_target(target) as con:
        _write_quantity_frames(con, oqty, qop, item_properties)


# ---------------------------------------------------------------------------
# XML
# ---------------------------------------------------------------------------
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

    # The sliced fragment's root element *is* the quantity extension.
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
    # Each <property> declares its OCEL type; collect them so the assembled frame
    # can be cast below. Without that every property stays the text it was parsed
    # as, and a numeric one comes back as a string.
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
        _write_quantity_frames(con, oqty, qop, item_properties)


# ---------------------------------------------------------------------------
# SQLite
# ---------------------------------------------------------------------------
def import_quantities_sqlite(
    con: duckdb.DuckDBPyConnection,
    present: set[str],
    property_casts: dict[str, str] | None = None,
) -> None:
    """Copy the quantity-extension tables from the attached SQLite source.

    Requires the source to already be attached as ``src`` (as the SQLite importer
    does). Every copy is a single ``CREATE TABLE ... AS SELECT`` that DuckDB
    streams internally, so nothing flows through Python. ``present`` is the set of
    source table names, used to skip extension tables the file does not have.

    ``property_casts`` maps an item-property column to the DuckDB type to read it
    as, recovered from the file's declared types by the caller (which is the only
    place they are still visible -- see :func:`~..sqlite.import_ocel_sqlite`).
    Without it the properties come back as text.
    """
    if SQL_QUANTITIES in present:
        con.execute(
            f'CREATE TABLE "{QUANTITIES_TABLE}" AS SELECT '
            f'"{SQL_KEYMAP[OID_COL]}" AS "{OID_COL}", '
            f'"{SQL_KEYMAP[QEL_ITEM_TYPE]}" AS "{QEL_ITEM_TYPE}", '
            f'TRY_CAST("{SQL_KEYMAP[QEL_QUANTITY]}" AS DOUBLE) AS "{QEL_QUANTITY}" '
            f'FROM src."{SQL_QUANTITIES}"'
        )

    if SQL_OPERATIONS in present:
        con.execute(
            f'CREATE TABLE "{QUANTITY_OPERATIONS_TABLE}" AS SELECT '
            f'"{SQL_KEYMAP[EID_COL]}" AS "{EID_COL}", '
            f'"{SQL_KEYMAP[OID_COL]}" AS "{OID_COL}", '
            f'"{SQL_KEYMAP[QEL_ITEM_TYPE]}" AS "{QEL_ITEM_TYPE}", '
            f'TRY_CAST("{SQL_KEYMAP[QEL_QUANTITY]}" AS DOUBLE) AS "{QEL_QUANTITY}" '
            f'FROM src."{SQL_OPERATIONS}"'
        )

    if SQL_ITEM_PROPERTIES in present:
        # Item-property columns are user-defined, so keep them all and only rename
        # the item-type column to the canonical name. ``property_casts`` carries
        # their declared SQLite types, which the attached copy no longer shows
        # (``sqlite_all_varchar`` reports every column as VARCHAR), so a numeric
        # property has to be cast back here or it stays text.
        columns = [
            description[0]
            for description in con.execute(
                f'SELECT * FROM src."{SQL_ITEM_PROPERTIES}" LIMIT 0'
            ).description
        ]
        type_column = SQL_KEYMAP[QEL_ITEM_TYPE]
        casts = property_casts or {}
        projection = ", ".join(
            f'"{column}" AS "{QEL_ITEM_TYPE}"'
            if column == type_column
            else (
                f'TRY_CAST("{column}" AS {casts[column]}) AS "{column}"'
                if column in casts
                else f'"{column}"'
            )
            for column in columns
        )
        con.execute(
            f'CREATE TABLE "{QUANTITY_ITEM_PROPERTIES_TABLE}" AS '
            f'SELECT {projection} FROM src."{SQL_ITEM_PROPERTIES}"'
        )
