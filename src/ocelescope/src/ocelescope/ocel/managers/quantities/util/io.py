import os
import sqlite3
import xml.etree.ElementTree as etree
from pathlib import Path

import orjson
import pandas as pd

from ocelescope.ocel.constants.pm4py import EID_COL, OID_COL
from ocelescope.ocel.constants.quantity import OQTY_COLUMNS, QOP_COLUMNS
from ocelescope.util.pandas import coerce_series, infer_column_dtype

from .constants import (
    JSON_KEYMAP,
    JSON_OPERATIONS,
    JSON_PROPERTIES,
    JSON_QUANTITIES,
    JSON_QUANTITY_EXTENSION,
    QEL_ITEM_TYPE,
    QEL_QUANTITY,
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


# TODO: This is also a bit inefficient
def write_extension_to_xml(
    path: Path, oqty: pd.DataFrame, qop: pd.DataFrame, item_properties: pd.DataFrame
):
    quantity_extension = etree.Element(XML_QUANTITY_EXTENSION)

    # Quantity Operations
    operations = etree.Element(XML_OPERATIONS)
    for _, row in qop.iterrows():
        operation = etree.SubElement(
            operations,
            XML_OPERATION,
            {XML_EVENT_ID: str(row[EID_COL]), XML_OBJECT_ID: str(row[OID_COL])},
        )
        item = etree.SubElement(operation, XML_ITEM, {XML_ITEM_TYPE: str(row[QEL_ITEM_TYPE])})
        item.text = str(row[QEL_QUANTITY])
    quantity_extension.append(operations)

    # Object Quantities
    object_quantities = etree.Element(XML_QUANTITIES)
    for _, row in oqty.iterrows():
        quantity = etree.SubElement(
            object_quantities,
            XML_QUANTITY,
            {
                XML_OBJECT_ID: str(row[OID_COL]),
                XML_QUANTITY_TYPE: str(row[QEL_ITEM_TYPE]),
            },
        )
        quantity.text = str(row[QEL_QUANTITY])

    quantity_extension.append(object_quantities)

    # Item Properties
    column_type_map = {
        str(col_name): infer_column_dtype(col_values)
        for col_name, col_values in item_properties.drop(
            columns=[QEL_ITEM_TYPE], errors="ignore"
        ).items()
    }

    item_properties_tree = etree.Element(XML_PROPERTIES)

    for _, row in item_properties.iterrows():
        item_type_root = etree.SubElement(
            item_properties_tree,
            XML_PROPERTIES_TYPE,
            {XML_PROPERTIES_TYPE_NAME: row[QEL_ITEM_TYPE]},
        )
        for property_name, value in row.dropna().drop(labels=[QEL_ITEM_TYPE]).items():
            property = etree.SubElement(
                item_type_root,
                XML_PROPERTY,
                {
                    XML_PROPERTY_NAME: str(property_name),
                    XML_PROPERTY_TYPE: column_type_map[str(property_name)],
                },
            )
            property.text = str(value)

    quantity_extension.append(item_properties_tree)

    # Export
    log = etree.parse(path)
    log.getroot().append(quantity_extension)
    log.write(path, xml_declaration=True, encoding="UTF-8")


def read_extension_from_xml(path: Path) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    tree = etree.parse(path)
    root = tree.getroot()

    quantity_ext = root.find(XML_QUANTITY_EXTENSION)
    if quantity_ext is None:
        return (
            pd.DataFrame(columns=OQTY_COLUMNS),
            pd.DataFrame(columns=QOP_COLUMNS),
            pd.DataFrame(columns=[QEL_ITEM_TYPE]),
        )

    operations_data = []
    operations_elem = quantity_ext.find(XML_OPERATIONS)
    if operations_elem is not None:
        for op in operations_elem.findall(XML_OPERATION):
            eid = op.attrib.get(XML_EVENT_ID, "")
            oid = op.attrib.get(XML_OBJECT_ID, "")
            item_elem = op.find(XML_ITEM)
            if item_elem is not None:
                item_type = item_elem.attrib.get(XML_ITEM_TYPE, "")
                quantity = item_elem.text or ""
                operations_data.append(
                    {
                        EID_COL: eid,
                        OID_COL: oid,
                        QEL_ITEM_TYPE: item_type,
                        QEL_QUANTITY: float(quantity),
                    }
                )

    # Read quantities
    quantities_data = []
    quantities_elem = quantity_ext.find(XML_QUANTITIES)
    if quantities_elem is not None:
        for q in quantities_elem.findall(XML_QUANTITY):
            oid = q.attrib.get(XML_OBJECT_ID, "")
            item_type = q.attrib.get(XML_QUANTITY_TYPE, "")
            quantity = q.text or ""
            quantities_data.append(
                {
                    OID_COL: oid,
                    QEL_ITEM_TYPE: item_type,
                    QEL_QUANTITY: float(quantity),
                }
            )

    # Read properties
    property_tree = quantity_ext.find(XML_PROPERTIES)

    item_property_data = []
    if property_tree is not None:
        for item_type in property_tree.findall(XML_PROPERTIES_TYPE):
            item_property_data.append(
                {
                    QEL_ITEM_TYPE: item_type.attrib[XML_PROPERTIES_TYPE_NAME],
                    **{
                        property_element.attrib[XML_PROPERTY_NAME]: property_element.text
                        for property_element in item_type.findall(XML_PROPERTY)
                    },
                }
            )

    oqty_df = pd.DataFrame(quantities_data, columns=OQTY_COLUMNS)
    qop_df = pd.DataFrame(operations_data, columns=QOP_COLUMNS)
    property_df = (
        pd.DataFrame(item_property_data)
        if len(item_property_data) > 0
        else pd.DataFrame(columns=[QEL_ITEM_TYPE])
    )

    return oqty_df, qop_df, property_df


def read_extension_from_json(path: Path) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    with open(path, "rb") as f:
        json = orjson.loads(f.read())

        quantityExtension = json.get(
            JSON_QUANTITY_EXTENSION, {JSON_OPERATIONS: [], JSON_QUANTITIES: [], JSON_PROPERTIES: []}
        )

        oqty: pd.DataFrame = pd.DataFrame.from_records(
            data=quantityExtension.get(JSON_QUANTITIES, []),
            columns=[JSON_KEYMAP[OID_COL], JSON_KEYMAP[QEL_ITEM_TYPE], JSON_KEYMAP[QEL_QUANTITY]],
        ).rename(columns=inverse_keymap(JSON_KEYMAP))

        qop: pd.DataFrame = pd.DataFrame.from_records(
            data=quantityExtension.get(JSON_OPERATIONS, []),
            columns=[
                JSON_KEYMAP[EID_COL],
                JSON_KEYMAP[OID_COL],
                JSON_KEYMAP[QEL_ITEM_TYPE],
                JSON_KEYMAP[QEL_QUANTITY],
            ],
        ).rename(columns=inverse_keymap(JSON_KEYMAP))

        properties: pd.DataFrame = (
            (
                pd.DataFrame.from_records(
                    data=quantityExtension[JSON_PROPERTIES],
                ).rename(columns=inverse_keymap(JSON_KEYMAP))
            )
            if len(quantityExtension.get(JSON_PROPERTIES, [])) > 0
            else pd.DataFrame(columns=[QEL_ITEM_TYPE])
        )

    return (oqty, qop, properties)


def write_extension_to_json(
    path: Path, oqty: pd.DataFrame, qop: pd.DataFrame, item_properties: pd.DataFrame
):
    ocel = orjson.loads(path.read_bytes())

    renamed_oqty = oqty.rename(columns=JSON_KEYMAP)

    renamed_qop = qop.rename(columns=JSON_KEYMAP)

    renamed_properties = item_properties.rename(columns=JSON_KEYMAP)

    ocel[JSON_QUANTITY_EXTENSION] = {
        JSON_QUANTITIES: renamed_oqty.to_dict(orient="records"),
        JSON_OPERATIONS: renamed_qop.to_dict(orient="records"),
        JSON_PROPERTIES: orjson.loads(
            renamed_properties.to_json(orient="records", date_format="iso")
        ),
    }

    data = orjson.dumps(ocel, option=orjson.OPT_APPEND_NEWLINE)

    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def write_extension_to_sqlite(
    path: Path, oqty: pd.DataFrame, qop: pd.DataFrame, item_properties: pd.DataFrame
):
    with sqlite3.connect(path) as conn:
        oqty.rename(columns=SQL_KEYMAP).to_sql(SQL_QUANTITIES, conn, index=False)
        qop.rename(columns=SQL_KEYMAP).to_sql(SQL_OPERATIONS, conn, index=False)
        item_properties.rename(columns=SQL_KEYMAP).to_sql(SQL_ITEM_PROPERTIES, conn, index=False)


def read_table_from_sqlite(conn: sqlite3.Connection, table_name: str, fallback_columns: list[str]):
    query_string = "SELECT * FROM {table_name}"
    try:
        return pd.read_sql_query(
            query_string.format(table_name=table_name), conn, index_col=None
        ).rename(columns=inverse_keymap(SQL_KEYMAP))
    except Exception:
        return pd.DataFrame(columns=fallback_columns)


def read_extension_from_sqlite(path: Path) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    with sqlite3.connect(path) as conn:
        oqty, qop, item_properties = [
            read_table_from_sqlite(conn, table_name, fallback_columns)
            for table_name, fallback_columns in [
                (SQL_QUANTITIES, OQTY_COLUMNS),
                (SQL_OPERATIONS, QOP_COLUMNS),
                (SQL_ITEM_PROPERTIES, [QEL_ITEM_TYPE]),
            ]
        ]

    return oqty, qop, item_properties


def read_quantity_extension(path: Path) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:

    match path.suffix:
        case ".xmlocel" | ".xml":
            oqty, qop, item_properties = read_extension_from_xml(path)
        case ".jsonocel" | ".json":
            oqty, qop, item_properties = read_extension_from_json(path)
        case ".sqlite":
            oqty, qop, item_properties = read_extension_from_sqlite(path)
        case _:
            raise ValueError(f"Unsupported extension: {path.suffix}")

    return oqty, qop, item_properties.apply(coerce_series)


def write_quantity_extension(
    path: Path, oqty: pd.DataFrame, qop: pd.DataFrame, item_properties: pd.DataFrame
):

    match path.suffix:
        case ".xmlocel" | ".xml":
            return write_extension_to_xml(path, oqty=oqty, qop=qop, item_properties=item_properties)
        case ".jsonocel" | ".json":
            return write_extension_to_json(
                path, oqty=oqty, qop=qop, item_properties=item_properties
            )
        case ".sqlite":
            return write_extension_to_sqlite(
                path, oqty=oqty, qop=qop, item_properties=item_properties
            )
        case _:
            raise ValueError(f"Unsupported extension: {path.suffix}")
