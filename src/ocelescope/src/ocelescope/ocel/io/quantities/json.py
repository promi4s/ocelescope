import io
import os
from decimal import Decimal
from pathlib import Path

import duckdb
import ijson
import orjson
import pandas as pd

from ocelescope.ocel.constants.pm4py import EID_COL, OID_COL
from ocelescope.ocel.constants.quantity import (
    QEL_ITEM_TYPE,
    QEL_QUANTITY,
    QUANTITIES_TABLE,
    QUANTITY_ITEM_PROPERTIES_TABLE,
    QUANTITY_OPERATIONS_TABLE,
)
from ocelescope.ocel.io.connection import DuckDBTarget, connect_target
from ocelescope.ocel.io.quantities.util import fetch_dicts, inverse_keymap, write_quantity_frames
from ocelescope.util.sql import ident

JSON_QUANTITY_EXTENSION = "quantityExtension"
JSON_OPERATIONS = "operations"
JSON_PROPERTIES = "itemTypes"
JSON_QUANTITIES = "quantities"

JSON_KEYMAP = {
    EID_COL: "eventId",
    OID_COL: "objectId",
    QEL_ITEM_TYPE: "type",
    QEL_QUANTITY: "quantity",
}


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
        write_quantity_frames(con, oqty, qop, item_properties)


_WHITESPACE = b" \t\r\n"

_DUMP_OPTS = orjson.OPT_NAIVE_UTC | orjson.OPT_UTC_Z
"""Write timestamps as UTC with a ``Z``, the way an OCEL 2.0 JSON log spells them."""


def _fallback(value: object) -> float:
    """Serialise what orjson will not: a DECIMAL item property comes back as one."""
    if isinstance(value, Decimal):
        return float(value)
    raise TypeError(f"cannot serialise {type(value).__name__}")


def _last_significant(stream: io.BufferedRandom, before: int) -> tuple[int, bytes]:
    """The position and value of the last non-whitespace byte before ``before``."""
    position = before
    while position > 0:
        position -= 1
        stream.seek(position)
        byte = stream.read(1)
        if byte not in _WHITESPACE:
            return position, byte
    raise ValueError("no JSON content")


def _add_member(target: str | Path, key: str, value: dict) -> None:
    """Add ``key: value`` to the JSON object a file holds, in place.

    The log itself is never parsed, re-encoded or copied. A JSON object ends at
    its closing brace, so the brace is found by scanning back over the file's
    trailing whitespace, the file is truncated there, and the new member is
    written in its place -- work proportional to the member, not to a log that
    can run to gigabytes.
    """
    with open(target, "r+b") as stream:
        stream.seek(0, os.SEEK_END)
        brace, byte = _last_significant(stream, stream.tell())
        if byte != b"}":
            raise ValueError(f"{target} does not end in a JSON object")

        _, preceding = _last_significant(stream, brace)

        stream.seek(brace)
        stream.truncate()

        if preceding != b"{":
            stream.write(b",")
        stream.write(orjson.dumps(key, option=_DUMP_OPTS))
        stream.write(b":")
        stream.write(orjson.dumps(value, option=_DUMP_OPTS, default=_fallback))
        stream.write(b"}")


def export_quantities_json(con: duckdb.DuckDBPyConnection, target: str | Path) -> None:
    """Add the ``quantityExtension`` object to the JSON log at ``target``.

    The log is written by r4pm, which knows nothing of the extension, so this
    appends it afterwards -- see :func:`_add_member` for why that costs no more
    than the extension itself. A log whose three tables are all empty is left
    exactly as it was, extension key and all.
    """
    quantities = fetch_dicts(
        con,
        f'SELECT "{OID_COL}" AS "{JSON_KEYMAP[OID_COL]}", '
        f'"{QEL_ITEM_TYPE}" AS "{JSON_KEYMAP[QEL_ITEM_TYPE]}", '
        f'"{QEL_QUANTITY}" AS "{JSON_KEYMAP[QEL_QUANTITY]}" FROM "{QUANTITIES_TABLE}"',
    )

    operations = fetch_dicts(
        con,
        f'SELECT "{EID_COL}" AS "{JSON_KEYMAP[EID_COL]}", '
        f'"{OID_COL}" AS "{JSON_KEYMAP[OID_COL]}", '
        f'"{QEL_ITEM_TYPE}" AS "{JSON_KEYMAP[QEL_ITEM_TYPE]}", '
        f'"{QEL_QUANTITY}" AS "{JSON_KEYMAP[QEL_QUANTITY]}" FROM "{QUANTITY_OPERATIONS_TABLE}"',
    )

    item_types = fetch_dicts(
        con,
        f"""
            SELECT
                {ident(QEL_ITEM_TYPE)} AS {ident(JSON_KEYMAP[QEL_ITEM_TYPE])},
                COLUMNS(* EXCLUDE ({ident(QEL_ITEM_TYPE)}))
            FROM {ident(QUANTITY_ITEM_PROPERTIES_TABLE)}
    """,
    )

    if not (quantities or operations or item_types):
        return

    _add_member(
        target,
        JSON_QUANTITY_EXTENSION,
        {
            JSON_QUANTITIES: quantities,
            JSON_OPERATIONS: operations,
            JSON_PROPERTIES: item_types,
        },
    )
