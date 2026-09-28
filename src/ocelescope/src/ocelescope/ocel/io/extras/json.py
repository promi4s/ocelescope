"""Copy the non-OCEL top-level lists of a JSON OCEL log into DuckDB.

Every top-level key whose value is a list of flat objects, other than the four
OCEL ones, becomes a table of its own name. The log is read in one streamed pass
(``ijson``), rows are collected in batches and handed to DuckDB through Arrow.

The deprecated ``quantityExtension`` object is read in the same pass: its lists
go straight into the quantity tables, with their columns renamed on insert, and a
:class:`DeprecationWarning` is emitted.

Writing is the reverse: :func:`export_extras_json` lets DuckDB write each extra
table as a JSON array (``COPY ... (FORMAT json, ARRAY true)``) and splices it into
the log as a top-level member, so no row passes through Python.
"""

from __future__ import annotations

import json
import os
import shutil
import tempfile
import warnings
from pathlib import Path
from typing import Any

import duckdb
import ijson
import pyarrow as pa

from ocelescope.ocel.constants.quantity import (
    QEL_QUANTITY,
    QUANTITIES_TABLE,
    QUANTITY_ITEM_PROPERTIES_TABLE,
    QUANTITY_OPERATIONS_TABLE,
)
from ocelescope.ocel.io.connection import DuckDBTarget, connect_target
from ocelescope.ocel.io.extras.quantities.json import (
    JSON_KEYMAP,
    JSON_OPERATIONS,
    JSON_PROPERTIES,
    JSON_QUANTITIES,
    JSON_QUANTITY_EXTENSION,
)
from ocelescope.util.sql import ident, literal

SKIPPED_KEYS = {"objects", "events", "eventTypes", "objectTypes"}
OCEL_NESTED = ("attributes", "relationships")
BATCH_SIZE = 50_000

LEGACY_TABLES = {
    JSON_OPERATIONS: QUANTITY_OPERATIONS_TABLE,
    JSON_QUANTITIES: QUANTITIES_TABLE,
    JSON_PROPERTIES: QUANTITY_ITEM_PROPERTIES_TABLE,
}
"""A list of the deprecated ``quantityExtension`` object -> the quantity table it fills."""


def may_have_extra_lists(path: Path, chunk_size: int = 1 << 24) -> bool:
    """False: the only list-valued keys are the OCEL ones, so there are no extra tables.
    True: there might be extra tables (or a string value contains `":[`), do the full pass.
    """
    with path.open("rb") as f:
        head = f.read(4096)
    sep = b'": [' if b'": [' in head else b'":['  # json.dump(indent=...) vs compact
    nested = [f'"{k}'.encode() + sep for k in OCEL_NESTED]
    top = {f'"{k}'.encode() + sep for k in SKIPPED_KEYS}
    overlap = max(len(p) for p in (*nested, *top)) - 1
    total = known = 0
    tail = b""
    with path.open("rb") as f:
        while chunk := f.read(chunk_size):
            buf = tail + chunk
            total += buf.count(sep) - tail.count(sep)
            known += sum(buf.count(p) - tail.count(p) for p in nested)
            top -= {p for p in top if p in buf}
            tail = buf[-overlap:]
    return total - known > len(SKIPPED_KEYS) - len(top)


def insert_batch(
    con: duckdb.DuckDBPyConnection,
    table: str,
    rows: list[dict[str, Any]],
    created: set[str],
    legacy: bool,
):
    """Insert ``rows`` into ``table``, creating it with the first batch.

    A legacy quantity table replaces one of the same name, and its JSON column
    names are renamed to ours on the way in.
    """
    batch = pa.Table.from_pylist(rows)
    select = "*"
    if legacy:
        renames = ", ".join(
            f"{ident(json_name)} AS {ident(our_name)}"
            for our_name, json_name in JSON_KEYMAP.items()
            if json_name in batch.column_names
        )
        if renames:
            select = f"* RENAME ({renames})"

    if table in created:
        con.execute(f"INSERT INTO {ident(table)} BY NAME SELECT {select} FROM batch")
    else:
        create = "CREATE OR REPLACE TABLE" if legacy else "CREATE TABLE"
        con.execute(f"{create} {ident(table)} AS SELECT {select} FROM batch")
        created.add(table)
    rows.clear()


def load_lists(path: Path, con: duckdb.DuckDBPyConnection) -> set[str]:
    """Loads every top-level list not in SKIPPED_KEYS into its own table. Rows must be flat objects.

    The lists of a ``quantityExtension`` object go into the quantity tables. Returns
    the legacy quantity tables that were filled.
    """
    created: set[str] = set()
    legacy_filled: set[str] = set()
    table: str = ""
    table_depth = 1
    in_container = False
    legacy = False
    skipping = False
    depth = 0
    rows: list[dict[str, Any]] = []
    row: dict[str, Any] = {}
    key: str = ""
    with path.open("rb") as f:
        for event, value in ijson.basic_parse(f, use_float=True):
            if event in ("start_map", "start_array"):
                depth += 1
            elif event in ("end_map", "end_array"):
                depth -= 1

            if depth == 1 and event == "map_key":
                in_container = value == JSON_QUANTITY_EXTENSION
                table, table_depth, legacy = value, 1, False
                skipping = value in SKIPPED_KEYS or in_container
                continue
            if in_container and depth == 2 and event == "map_key":
                legacy = value in LEGACY_TABLES
                table, table_depth, skipping = (
                    LEGACY_TABLES.get(value, ""),
                    2,
                    not legacy,
                )
                continue
            if skipping:
                continue

            if depth == table_depth + 2 and event == "start_map":
                row = {}
            elif depth == table_depth + 1 and event == "end_map":
                rows.append(row)
                if len(rows) >= BATCH_SIZE:
                    insert_batch(con, table, rows, created, legacy)
            elif depth == table_depth and event == "end_array":
                if rows:
                    insert_batch(con, table, rows, created, legacy)
                    if legacy:
                        legacy_filled.add(table)
            elif event == "map_key":
                key = value
            elif depth == table_depth + 2:
                row[key] = value
    return legacy_filled


def _quantities_as_double(con: duckdb.DuckDBPyConnection, tables: set[str]) -> None:
    """A quantity is a number, whatever the file stored it as (``"1.0"`` included)."""
    for table in tables & {QUANTITIES_TABLE, QUANTITY_OPERATIONS_TABLE}:
        column_types = dict(
            con.execute(
                f"SELECT column_name, column_type FROM (DESCRIBE {ident(table)})"
            ).fetchall()
        )
        if column_types.get(QEL_QUANTITY, "DOUBLE") != "DOUBLE":
            con.execute(
                f"ALTER TABLE {ident(table)} ALTER {ident(QEL_QUANTITY)} "
                f"TYPE DOUBLE USING TRY_CAST({ident(QEL_QUANTITY)} AS DOUBLE)"
            )


def import_extras_json(path: str | Path, target: DuckDBTarget) -> None:
    """Copy every extra top-level list of the JSON log at ``path`` into the DuckDB at ``target``.

    A deprecated ``quantityExtension`` object is read into the quantity tables in
    the same pass, with a :class:`DeprecationWarning`.
    """
    path = Path(path)
    if not may_have_extra_lists(path):
        return
    with connect_target(target) as con:
        legacy_filled = load_lists(path, con)
        if not legacy_filled:
            return
        _quantities_as_double(con, legacy_filled)
    warnings.warn(
        f"The JSON {JSON_QUANTITY_EXTENSION!r} object is deprecated. Its lists were "
        f"read into {', '.join(repr(table) for table in sorted(legacy_filled))}.",
        DeprecationWarning,
        stacklevel=2,
    )


_WHITESPACE = b" \t\r\n"


def _last_significant(stream, before: int) -> tuple[int, bytes]:
    """The position and value of the last non-whitespace byte before ``before``."""
    position = before
    while position > 0:
        position -= 1
        stream.seek(position)
        byte = stream.read(1)
        if byte not in _WHITESPACE:
            return position, byte
    raise ValueError("no JSON content")


def export_extras_json(
    con: duckdb.DuckDBPyConnection, target: str | Path, tables: list[str]
) -> None:
    """Add every table in ``tables`` to the JSON log at ``target`` as a top-level list.

    Each table keeps its name and its column names. DuckDB writes the array to a
    temporary file next to the log, which is then copied in before the log's
    closing brace -- the log itself is neither parsed nor rewritten.
    """
    if not tables:
        return
    target = Path(target)
    with tempfile.TemporaryDirectory(dir=target.parent) as scratch:
        arrays = []
        for index, table in enumerate(tables):
            array = Path(scratch) / f"{index}.json"
            con.execute(
                f"COPY (SELECT * FROM {ident(table)}) TO {literal(str(array))} "
                "(FORMAT json, ARRAY true)"
            )
            arrays.append((table, array))

        with open(target, "r+b") as stream:
            stream.seek(0, os.SEEK_END)
            brace, byte = _last_significant(stream, stream.tell())
            if byte != b"}":
                raise ValueError(f"{target} is not a JSON object")
            _, preceding = _last_significant(stream, brace)
            needs_comma = preceding != b"{"

            stream.seek(brace)
            stream.truncate()
            for table, array in arrays:
                if needs_comma:
                    stream.write(b",")
                needs_comma = True
                stream.write(json.dumps(table).encode() + b":")
                with open(array, "rb") as source:
                    shutil.copyfileobj(source, stream, 1 << 20)
            stream.write(b"}")
