"""Streaming exporter: DuckDB OCEL tables -> OCEL 2.0 JSON log."""

from __future__ import annotations

import os
from pathlib import Path
from typing import IO, Iterable

import orjson

from ocelescope.ocel.io.exporters.common import (
    event_types,
    iter_events,
    iter_objects,
    object_types,
)
from ocelescope.ocel.io.connection import DuckDBTarget, connect_target
from ocelescope.ocel.io.exporters.quantities import json_quantity_extension
from ocelescope.ocel.constants.quantity import JSON_QUANTITY_EXTENSION


def _stream_array(stream: IO[bytes], items: Iterable[dict]) -> None:
    """Write ``items`` as the elements of a JSON array (brackets written by caller)."""
    first = True
    for item in items:
        if not first:
            stream.write(b",")
        stream.write(orjson.dumps(item))
        first = False


def export_ocel_json(source: DuckDBTarget, target: str | Path) -> None:
    """Write the OCEL in the DuckDB at ``source`` to a JSON log at ``target``.

    The type declarations (small) are materialised, then the objects and events
    arrays are streamed straight from DuckDB record by record, so peak memory
    stays bounded by a single entity rather than the whole log. Written to a
    temp file and atomically renamed so a failure never leaves a partial log.

    Args:
        source: Path to a DuckDB database holding the flat OCEL tables, or an
            open connection to one (e.g. an :class:`ocelescope.OCEL`'s own).
        target: Output path for the JSON log.
    """
    target = Path(target)
    tmp = target.with_suffix(target.suffix + ".tmp")

    with connect_target(source, read_only=True) as con:
        con.execute("SET TimeZone='UTC'")

        object_type_decls = object_types(con)
        event_type_decls = event_types(con)
        quantity_extension = json_quantity_extension(con)

        with open(tmp, "wb") as stream:
            stream.write(b'{"objectTypes":')
            stream.write(orjson.dumps(object_type_decls))
            stream.write(b',"eventTypes":')
            stream.write(orjson.dumps(event_type_decls))

            stream.write(b',"objects":[')
            _stream_array(stream, iter_objects(con))
            stream.write(b'],"events":[')
            _stream_array(stream, iter_events(con))
            stream.write(b"]")

            if quantity_extension is not None:
                stream.write(b',"' + JSON_QUANTITY_EXTENSION.encode() + b'":')
                stream.write(orjson.dumps(quantity_extension))

            stream.write(b"}")

    os.replace(tmp, target)
