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

from ocelescope.ocel.io.connection import DuckDBTarget, connect_target
from ocelescope.ocel.io.extras.quantities.json import (
    JSON_KEYMAP,
    JSON_QUANTITY_EXTENSION,
    JSON_TABLES,
)
from ocelescope.ocel.io.extras.quantities.util import quantity_as_double
from ocelescope.ocel.io.extras.tables import rows_to_arrow
from ocelescope.util.sql import ident, literal

SKIPPED_KEYS = {"objects", "events", "eventTypes", "objectTypes"}
OCEL_NESTED = ("attributes", "relationships")
BATCH_SIZE = 50_000


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


_BATCH_VIEW = "_extras_batch"
"""Name a batch is registered under while it is written."""


def _column_types(con: duckdb.DuckDBPyConnection, relation: str) -> dict[str, str]:
    return {
        name: column_type
        for name, column_type, *_ in con.execute(f"DESCRIBE {relation}").fetchall()
    }


def insert_batch(
    con: duckdb.DuckDBPyConnection,
    table: str,
    rows: list[dict[str, Any]],
    created: set[str],
    null_columns: dict[str, set[str]],
    legacy: bool,
):
    """Insert ``rows`` into ``table``, creating it with the first batch.

    A column that is NULL throughout a batch does not decide its type -- the
    exporter writes ``null`` explicitly, so a sparse column can start with a whole
    batch of them. It is added once a later batch has values, and one that never
    has any is recorded in ``null_columns`` for :func:`_add_null_columns`. A column
    whose type changes from one batch to the next raises.

    A legacy quantity table replaces one of the same name, and its JSON column
    names are renamed to ours on the way in.
    """
    batch = rows_to_arrow(rows, table)
    if legacy:
        rename = {json_name: our_name for our_name, json_name in JSON_KEYMAP.items()}
        batch = batch.rename_columns([rename.get(c, c) for c in batch.column_names])

    all_null = [f.name for f in batch.schema if pa.types.is_null(f.type)]
    null_columns.setdefault(table, set()).update(all_null)
    batch = batch.drop_columns(all_null)
    if batch.num_columns == 0:
        # only NULLs: keep the rows, with one column as text to carry them
        batch = pa.table({all_null[0]: pa.nulls(len(rows), pa.string())})

    con.register(_BATCH_VIEW, batch)
    try:
        if table not in created:
            create = "CREATE OR REPLACE TABLE" if legacy else "CREATE TABLE"
            con.execute(f"{create} {ident(table)} AS SELECT * FROM {_BATCH_VIEW}")
            created.add(table)
        else:
            existing = _column_types(con, ident(table))
            for column, incoming in _column_types(con, _BATCH_VIEW).items():
                if column not in existing:
                    con.execute(
                        f"ALTER TABLE {ident(table)} ADD COLUMN {ident(column)} {incoming}"
                    )
                elif incoming != existing[column]:
                    raise ValueError(
                        f"column {column!r} of extra table {table!r} changes type "
                        f"from {existing[column]} to {incoming}"
                    )
            con.execute(
                f"INSERT INTO {ident(table)} BY NAME SELECT * FROM {_BATCH_VIEW}"
            )
    finally:
        con.unregister(_BATCH_VIEW)
    rows.clear()


def _add_null_columns(
    con: duckdb.DuckDBPyConnection, table: str, null_columns: dict[str, set[str]]
) -> None:
    """Add the columns of ``table`` that never held a value, as VARCHAR."""
    existing = _column_types(con, ident(table))
    for column in sorted(null_columns.pop(table, set()) - set(existing)):
        con.execute(f"ALTER TABLE {ident(table)} ADD COLUMN {ident(column)} VARCHAR")


def load_lists(path: Path, con: duckdb.DuckDBPyConnection) -> set[str]:
    """Loads every top-level list not in SKIPPED_KEYS into its own table. Rows must be flat objects.

    The lists of a ``quantityExtension`` object go into the quantity tables. Returns
    the legacy quantity tables that were filled.
    """
    created: set[str] = set()
    null_columns: dict[str, set[str]] = {}
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
                legacy = value in JSON_TABLES
                table, table_depth, skipping = (
                    JSON_TABLES.get(value, ""),
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
                    insert_batch(con, table, rows, created, null_columns, legacy)
            elif depth == table_depth and event == "end_array":
                if rows:
                    insert_batch(con, table, rows, created, null_columns, legacy)
                if table in created:
                    _add_null_columns(con, table, null_columns)
                    if legacy:
                        legacy_filled.add(table)
            elif event == "map_key":
                key = value
            elif depth == table_depth + 2:
                row[key] = value
    return legacy_filled


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
        for table in legacy_filled:
            quantity_as_double(con, table)
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
