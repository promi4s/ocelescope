import os
import sqlite3
import xml.etree.ElementTree as etree
from pathlib import Path

import orjson
import pandas as pd

from ocelescope.ocel.constants.pm4py import EID_COL, OID_COL

from .constants import (
    JSON_KEYMAP,
    JSON_OPERATIONS,
    JSON_QUANTITIES,
    JSON_QUANTITY_EXTENSION,
    QEL_ITEM_TYPE,
    QEL_QUANTITY,
    SQL_KEYMAP,
    SQL_OPERATIONS,
    SQL_QUANTITIES,
    XML_EVENT_ID,
    XML_ITEM,
    XML_ITEM_TYPE,
    XML_OBJECT_ID,
    XML_OPERATION,
    XML_OPERATIONS,
    XML_QUANTITIES,
    XML_QUANTITY,
    XML_QUANTITY_EXTENSION,
    XML_QUANTITY_TYPE,
    inverse_keymap,
)


def write_extension_to_xml(path: Path, oqty: pd.DataFrame, qop: pd.DataFrame):
    quantity_extension = etree.Element(XML_QUANTITY_EXTENSION)

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

    log = etree.parse(path)
    log.getroot().append(quantity_extension)
    log.write(path, xml_declaration=True, encoding="UTF-8")


def read_extension_from_xml(path: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    tree = etree.parse(path)
    root = tree.getroot()

    quantity_ext = root.find(XML_QUANTITY_EXTENSION)
    if quantity_ext is None:
        raise ValueError(f"No <{XML_QUANTITY_EXTENSION}> element found in XML.")

    # Read operations
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

    oqty_df = pd.DataFrame(quantities_data)
    qop_df = pd.DataFrame(operations_data)
    return oqty_df, qop_df


def read_extension_from_json(path: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    with open(path, "rb") as f:
        json = orjson.loads(f.read())

        quantityExtension = json[JSON_QUANTITY_EXTENSION] or {
            JSON_OPERATIONS: [],
            JSON_QUANTITIES: [],
        }

        oqty: pd.DataFrame = pd.DataFrame.from_records(
            data=quantityExtension[JSON_QUANTITIES],
            columns=[JSON_KEYMAP[OID_COL], JSON_KEYMAP[QEL_ITEM_TYPE], JSON_KEYMAP[QEL_QUANTITY]],
        ).rename(inverse_keymap(JSON_KEYMAP))

        qop: pd.DataFrame = pd.DataFrame.from_records(
            data=quantityExtension[JSON_OPERATIONS],
            columns=[
                JSON_KEYMAP[EID_COL],
                JSON_KEYMAP[OID_COL],
                JSON_KEYMAP[QEL_ITEM_TYPE],
                JSON_KEYMAP[QEL_QUANTITY],
            ],
        )

    return (oqty, qop)


def write_extension_to_json(path: Path, oqty: pd.DataFrame, qop: pd.DataFrame):
    ocel = orjson.loads(path.read_bytes())

    renamed_oqty = oqty.rename(columns=JSON_KEYMAP)

    renamed_qop = qop.rename(columns=JSON_KEYMAP)

    ocel[JSON_QUANTITY_EXTENSION] = {
        JSON_QUANTITIES: renamed_oqty.to_dict(orient="records"),
        JSON_OPERATIONS: renamed_qop.to_dict(orient="records"),
    }

    data = orjson.dumps(ocel, option=orjson.OPT_APPEND_NEWLINE)

    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def write_extension_to_sqlite(path: Path, oqty: pd.DataFrame, qop: pd.DataFrame):
    with sqlite3.connect(path) as conn:
        oqty.rename(columns=SQL_KEYMAP).to_sql(SQL_QUANTITIES, conn, index=False)
        qop.rename(columns=SQL_KEYMAP).to_sql(SQL_OPERATIONS, conn, index=False)


def read_extension_from_sqlite(path: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    with sqlite3.connect(path) as conn:
        query_string = "SELECT * FROM {table_name}"

        oqty = pd.read_sql_query(
            query_string.format(table_name=SQL_QUANTITIES),
            conn,
        ).rename(columns=inverse_keymap(SQL_KEYMAP))

        qop = (
            pd.read_sql_query(query_string.format(table_name=SQL_OPERATIONS), conn)
            .rename(columns=inverse_keymap(SQL_KEYMAP))
            .reset_index()
        )

    return oqty, qop
