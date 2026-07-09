"""Streaming importer for OCEL 2.0 JSON logs into DuckDB."""

from __future__ import annotations

from pathlib import Path

import ijson

from ocelescope.ocel.io.quantities import import_quantities_json
from ocelescope.ocel.io.schema import (
    ATTRIBUTE_TYPE_TO_ARROW,
    SchemaDefinition,
    merge_columns,
)
from ocelescope.ocel.io.writer import OCELWriter


def _attribute_schemas(source: str | Path) -> tuple[SchemaDefinition, SchemaDefinition]:
    """Read object- and event-type attribute columns in a single early pass.

    In OCEL 2.0 JSON the ``objectTypes``/``eventTypes`` declarations precede the
    ``objects``/``events`` data arrays, so we stop as soon as the first data
    array begins instead of scanning the whole (potentially multi-GB) file.
    """
    object_attrs: SchemaDefinition = []
    event_attrs: SchemaDefinition = []
    current_name: str = ""

    with open(source, "rb") as log_stream:
        for prefix, event, value in ijson.parse(log_stream):
            if event == "start_array" and prefix in ("objects", "events"):
                break
            if prefix.endswith("attributes.item.name"):
                current_name = str(value)
            elif prefix.endswith("attributes.item.type"):
                arrow_type = ATTRIBUTE_TYPE_TO_ARROW.get(value)
                if arrow_type is not None:
                    target = (
                        object_attrs
                        if prefix.startswith("objectTypes")
                        else event_attrs
                    )
                    target.append((current_name, arrow_type))

    return merge_columns(object_attrs), merge_columns(event_attrs)


def import_ocel_json(source: str | Path, db_path: str | Path) -> None:
    """Stream an OCEL 2.0 JSON log into a DuckDB database at ``db_path``."""
    object_columns, event_columns = _attribute_schemas(source)

    with OCELWriter(db_path, object_columns, event_columns) as writer:
        with open(source, "rb") as f:
            for obj in ijson.items(f, "objects.item", use_float=True):
                writer.add_object(obj)

        with open(source, "rb") as f:
            for event in ijson.items(f, "events.item", use_float=True):
                writer.add_event(event)

    import_quantities_json(source, db_path)
