"""Streaming exporter: DuckDB OCEL tables -> OCEL 2.0 XML log."""

from __future__ import annotations

import os
from datetime import date, datetime
from pathlib import Path
from typing import IO

import duckdb
import xml.etree.ElementTree as etree

from ocelescope.ocel.io.exporters.common import (
    event_types,
    iter_events,
    iter_objects,
    object_types,
)
from ocelescope.ocel.io.exporters.quantities import xml_quantity_extension


def _value_text(value: object) -> str:
    """Render an attribute value as element text the importer can cast back."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def _time_text(value: object) -> str:
    """Render an attribute timestamp (a real datetime or the initial sentinel)."""
    return value.isoformat() if isinstance(value, (datetime, date)) else str(value)


def _types_element(container: str, member: str, declarations: list[dict]) -> etree.Element:
    """Build an ``<object-types>`` / ``<event-types>`` section."""
    root = etree.Element(container)
    for declaration in declarations:
        type_element = etree.SubElement(root, member, {"name": declaration["name"]})
        attributes = etree.SubElement(type_element, "attributes")
        for attribute in declaration["attributes"]:
            etree.SubElement(
                attributes, "attribute", {"name": attribute["name"], "type": attribute["type"]}
            )
    return root


def _relationships_element(relationships: list[dict]) -> etree.Element | None:
    """Build the ``<objects>`` relationship container, or ``None`` if there are none."""
    if not relationships:
        return None
    container = etree.Element("objects")
    for relationship in relationships:
        attribs = {"object-id": str(relationship["objectId"])}
        if relationship["qualifier"] is not None:
            attribs["qualifier"] = str(relationship["qualifier"])
        etree.SubElement(container, "relationship", attribs)
    return container


def _object_element(obj: dict) -> etree.Element:
    element = etree.Element("object", {"id": str(obj["id"]), "type": str(obj["type"])})
    attributes = etree.SubElement(element, "attributes")
    for attribute in obj["attributes"]:
        attribute_element = etree.SubElement(
            attributes,
            "attribute",
            {"name": str(attribute["name"]), "time": _time_text(attribute["time"])},
        )
        attribute_element.text = _value_text(attribute["value"])
    relationships = _relationships_element(obj["relationships"])
    if relationships is not None:
        element.append(relationships)
    return element


def _event_element(event: dict) -> etree.Element:
    element = etree.Element(
        "event",
        {"id": str(event["id"]), "type": str(event["type"]), "time": _time_text(event["time"])},
    )
    attributes = etree.SubElement(element, "attributes")
    for attribute in event["attributes"]:
        attribute_element = etree.SubElement(
            attributes, "attribute", {"name": str(attribute["name"])}
        )
        attribute_element.text = _value_text(attribute["value"])
    relationships = _relationships_element(event["relationships"])
    if relationships is not None:
        element.append(relationships)
    return element


def _write_element(stream: IO[bytes], element: etree.Element) -> None:
    stream.write(etree.tostring(element, encoding="utf-8"))
    stream.write(b"\n")


def export_ocel_xml(db_path: str | Path, target: str | Path) -> None:
    """Write the OCEL in the DuckDB at ``db_path`` to an XML log at ``target``.

    Objects and events are serialised one element at a time straight from DuckDB,
    so peak memory stays bounded by a single entity rather than the whole log.
    Written to a temp file and atomically renamed.
    """
    target = Path(target)
    tmp = target.with_suffix(target.suffix + ".tmp")

    with duckdb.connect(str(db_path), read_only=True) as con:
        con.execute("SET TimeZone='UTC'")

        with open(tmp, "wb") as stream:
            stream.write(b'<?xml version="1.0" encoding="UTF-8"?>\n<log>\n')

            _write_element(stream, _types_element("object-types", "object-type", object_types(con)))
            _write_element(stream, _types_element("event-types", "event-type", event_types(con)))

            stream.write(b"<objects>\n")
            for obj in iter_objects(con):
                _write_element(stream, _object_element(obj))
            stream.write(b"</objects>\n<events>\n")
            for event in iter_events(con):
                _write_element(stream, _event_element(event))
            stream.write(b"</events>\n")

            quantity_extension = xml_quantity_extension(con)
            if quantity_extension is not None:
                _write_element(stream, quantity_extension)

            stream.write(b"</log>\n")

    os.replace(tmp, target)
