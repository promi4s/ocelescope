"""Streaming importer for OCEL 2.0 XML logs into DuckDB.

Follows the OCEL 2.0 XML schema (https://www.ocel-standard.org/2.0/), parsing
the file incrementally with ``lxml.iterparse`` and clearing finished elements so
memory stays bounded on large logs.
"""

from __future__ import annotations

from pathlib import Path

from lxml import etree

from ocelescope.ocel.io.connection import DuckDBTarget
from ocelescope.ocel.io.importers.quantities import import_quantities_xml
from ocelescope.ocel.io.importers.writer import OCELWriter
from ocelescope.ocel.io.schema import (
    ATTRIBUTE_TYPE_TO_ARROW,
    SchemaDefinition,
    merge_columns,
)


def _local(tag: object) -> str:
    """Local element name, ignoring any XML namespace."""
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def _attribute_schemas(source: str | Path) -> tuple[SchemaDefinition, SchemaDefinition]:
    """Read object- and event-type attribute columns in a single early pass.

    The ``object-types``/``event-types`` declarations precede the data in an
    OCEL 2.0 XML log, so we stop as soon as the first data section starts
    instead of parsing the whole (potentially multi-GB) file.
    """
    object_attrs: SchemaDefinition = []
    event_attrs: SchemaDefinition = []
    target: SchemaDefinition | None = None

    for event, elem in etree.iterparse(str(source), events=("start", "end")):
        tag = _local(elem.tag)
        if event == "start":
            if tag in ("objects", "events"):
                break
            if tag == "object-types":
                target = object_attrs
            elif tag == "event-types":
                target = event_attrs
        elif event == "end" and tag == "attribute" and target is not None:
            arrow_type = ATTRIBUTE_TYPE_TO_ARROW.get(elem.get("type"))
            if arrow_type is not None:
                target.append((elem.get("name"), arrow_type))

    return merge_columns(object_attrs), merge_columns(event_attrs)


def _build_object(elem) -> dict:
    """Turn an ``<object>`` element into the dict shape ``OCELWriter`` expects."""
    attributes: list[dict] = []
    relationships: list[dict] = []
    for child in elem:
        tag = _local(child.tag)
        if tag == "attributes":
            attributes = [
                {
                    "name": attr.get("name"),
                    "value": attr.text,
                    "time": attr.get("time") or None,
                }
                for attr in child
            ]
        elif tag == "objects":
            relationships = [
                {"qualifier": ref.get("qualifier"), "objectId": ref.get("object-id")}
                for ref in child
            ]
    return {
        "id": elem.get("id"),
        "type": elem.get("type"),
        "attributes": attributes,
        "relationships": relationships,
    }


def _build_event(elem) -> dict:
    """Turn an ``<event>`` element into the dict shape ``OCELWriter`` expects."""
    attributes: list[dict] = []
    relationships: list[dict] = []
    for child in elem:
        tag = _local(child.tag)
        if tag == "attributes":
            attributes = [
                {"name": attr.get("name"), "value": attr.text}
                for attr in child
                if attr.text is not None
            ]
        elif tag == "objects":
            relationships = [
                {"objectId": ref.get("object-id"), "qualifier": ref.get("qualifier")}
                for ref in child
            ]
    return {
        "id": elem.get("id"),
        "type": elem.get("type"),
        "time": elem.get("time"),
        "attributes": attributes,
        "relationships": relationships,
    }


def _clear(elem) -> None:
    """Drop a finished element and its processed siblings to keep memory bounded."""
    elem.clear()
    while elem.getprevious() is not None:
        del elem.getparent()[0]


def import_ocel_xml(source: str | Path, target: DuckDBTarget) -> None:
    """Stream an OCEL 2.0 XML log into the DuckDB database at ``target``."""
    object_columns, event_columns = _attribute_schemas(source)

    with OCELWriter(target, object_columns, event_columns) as writer:
        for _, elem in etree.iterparse(str(source), events=("end",), tag=("{*}object", "{*}event")):
            if _local(elem.tag) == "event":
                writer.add_event(_build_event(elem))
                _clear(elem)
            elif _local(elem.tag) == "object":
                writer.add_object(_build_object(elem))
                _clear(elem)

    import_quantities_xml(source, target)
