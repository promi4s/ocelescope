"""Copy the extra tables of an XML OCEL log into DuckDB, and back.

An extra table is a ``<table name="...">`` child of ``<log>``. Its ``<columns>``
declaration lists the columns in order, with their exact names and OCEL types, and
each ``<row .../>`` carries its values as positional attributes ``c0``, ``c1``, ...
-- so any table or column name works, ``ocel:oid`` included, which would not be a
valid attribute name itself. A row without an attribute has NULL there.

Sections are found by scanning bytes and only their own bytes are parsed, so the
OCEL body is never parsed here; a log with neither a ``<table>`` nor a legacy
section is not even scanned. Any other element under ``<log>`` is ignored.

The deprecated ``<quantity-extension>`` section is read into the quantity tables
instead, with a :class:`DeprecationWarning`.
"""

from __future__ import annotations

import mmap
import os
import warnings
from collections.abc import Iterator
from pathlib import Path
from typing import Any, cast
from xml.sax.saxutils import quoteattr

import duckdb
from lxml import etree

from ocelescope.ocel.io.connection import DuckDBTarget, connect_target
from ocelescope.ocel.io.extras.quantities.xml import (
    XML_QUANTITY_EXTENSION,
    read_legacy_xml_quantities,
)
from ocelescope.ocel.io.extras.tables import column_types as table_column_types
from ocelescope.ocel.io.extras.tables import rows_to_arrow
from ocelescope.ocel.io.schema import ATTRIBUTE_TYPE_TO_DUCKDB, duckdb_to_attribute_type
from ocelescope.util.sql import ident

TABLE_TAG = "table"
ROW_TAG = "row"
BATCH_SIZE = 50_000
EXPORT_BATCH_SIZE = 100_000


def find_element_end(file_bytes: mmap.mmap, tag_name: bytes, content_start: int) -> int:
    """content_start is just after <tag_name ...>. Returns the position after its matching </tag_name>,
    skipping nested elements with the same name."""
    closing_tag = b"</" + tag_name + b">"
    opening_tags = (b"<" + tag_name + b">", b"<" + tag_name + b" ")
    depth = 1
    search_from = content_start
    while True:
        closing_tag_start = file_bytes.find(closing_tag, search_from)
        if closing_tag_start < 0:
            raise ValueError(f"no closing tag for {tag_name!r}")
        bytes_in_between = file_bytes[search_from:closing_tag_start]
        depth += (
            sum(bytes_in_between.count(opening_tag) for opening_tag in opening_tags) - 1
        )
        search_from = closing_tag_start + len(closing_tag)
        if depth == 0:
            return search_from


def _may_have_extras(file_bytes: mmap.mmap) -> bool:
    """Whether a ``<table`` or ``<quantity-extension`` tag occurs anywhere at all.

    Two byte searches instead of a scan of every section; in XML a raw ``<``
    only ever opens a tag, so neither can hide inside a value.
    """
    return (
        file_bytes.find(b"<" + TABLE_TAG.encode()) >= 0
        or file_bytes.find(b"<" + XML_QUANTITY_EXTENSION.encode()) >= 0
    )


def find_extra_sections(path: Path) -> list[tuple[str, str, int, int]]:
    """``(element, table name, start, end)`` of every ``<table>`` and legacy section under <log>.

    The table name of a ``<table>`` is its ``name`` attribute. Every other child of
    ``<log>`` is jumped over without being parsed.
    """
    sections: list[tuple[str, str, int, int]] = []
    with (
        path.open("rb") as file,
        mmap.mmap(file.fileno(), 0, access=mmap.ACCESS_READ) as file_bytes,
    ):
        if not _may_have_extras(file_bytes):
            return sections
        position = file_bytes.find(b">", file_bytes.find(b"<log")) + 1
        while True:
            tag_start = file_bytes.find(b"<", position)
            tag_kind = file_bytes[tag_start + 1 : tag_start + 2]
            if tag_kind == b"/":
                return sections
            if tag_kind in (b"!", b"?"):
                terminator = b"-->" if tag_kind == b"!" else b"?>"
                position = file_bytes.find(terminator, tag_start) + len(terminator)
                continue
            tag_end = file_bytes.find(b">", tag_start)
            tag_content = file_bytes[tag_start + 1 : tag_end]
            element_name = tag_content.split(None, 1)[0].rstrip(b"/")
            is_self_closing = tag_content.endswith(b"/")
            position = (
                tag_end + 1
                if is_self_closing
                else find_element_end(file_bytes, element_name, tag_end + 1)
            )
            if element_name == TABLE_TAG.encode():
                opening_tag = file_bytes[tag_start : tag_end + 1]
                if not is_self_closing:
                    opening_tag += b"</" + element_name + b">"
                table_name = str(etree.fromstring(opening_tag).get("name"))
                sections.append((TABLE_TAG, table_name, tag_start, position))
            elif element_name == XML_QUANTITY_EXTENSION.encode():
                sections.append((XML_QUANTITY_EXTENSION, "", tag_start, position))


def read_column_types(
    path: Path, table_name: str, section_start: int, section_end: int
) -> dict[str, str]:
    """{column name: OCEL type}, in declared order, from the ``<table>``'s <columns>."""
    with (
        path.open("rb") as file,
        mmap.mmap(file.fileno(), 0, access=mmap.ACCESS_READ) as file_bytes,
    ):
        columns_start = file_bytes.find(b"<columns", section_start, section_end)
        if columns_start < 0:
            raise ValueError(f"<table name={table_name!r}> has no <columns>")
        columns_end = file_bytes.find(b"</columns>", columns_start, section_end) + len(
            b"</columns>"
        )
        declaration = etree.fromstring(file_bytes[columns_start:columns_end])
    return {str(column.get("name")): str(column.get("type")) for column in declaration}


def _duckdb_type(ocel_type: str) -> str:
    return ATTRIBUTE_TYPE_TO_DUCKDB.get(ocel_type, "VARCHAR")


def _cast(column: str, ocel_type: str) -> str:
    """SQL that turns the text of ``column`` into its OCEL type."""
    duckdb_type = _duckdb_type(ocel_type)
    if duckdb_type == "TIMESTAMP":
        # through TIMESTAMPTZ, so an offset like "Z" is applied instead of rejected
        return f"CAST(CAST({ident(column)} AS TIMESTAMPTZ) AS TIMESTAMP)"
    return f"CAST({ident(column)} AS {duckdb_type})"


def iter_rows(
    path: Path, section_start: int, section_end: int, chunk_size: int = 1 << 24
) -> Iterator[etree._Element]:
    """Parses only the bytes section_start:section_end (one section) and yields its rows one by one.

    Rows are the <row> elements. lxml filters them in C, so Python never sees anything else,
    e.g. the <columns> declaration. An empty section simply yields nothing.
    """
    with (
        path.open("rb") as file,
        mmap.mmap(file.fileno(), 0, access=mmap.ACCESS_READ) as file_bytes,
    ):
        parser = etree.XMLPullParser(events=("end",), tag=ROW_TAG, huge_tree=True)
        for chunk_start in range(section_start, section_end, chunk_size):
            chunk_end = min(chunk_start + chunk_size, section_end)
            parser.feed(file_bytes[chunk_start:chunk_end])
            for _, row_element in parser.read_events():
                row_element = cast(etree._Element, row_element)
                yield row_element
                row_element.clear()
                section_element = row_element.getparent()
                while (
                    section_element is not None
                    and (previous_row := row_element.getprevious()) is not None
                ):
                    section_element.remove(previous_row)
        parser.close()


def insert_batch(
    connection: duckdb.DuckDBPyConnection,
    table_name: str,
    records: list[dict[str, Any]],
    column_types: dict[str, str],
):
    """Inserts the records, cast to the declared column types."""
    arrow_batch = rows_to_arrow(records, table_name)
    select_list = ", ".join(
        f"{_cast(column_name, ocel_type)} AS {ident(column_name)}"
        for column_name, ocel_type in column_types.items()
        if column_name in arrow_batch.column_names
    )
    connection.execute(
        f"INSERT INTO {ident(table_name)} BY NAME SELECT {select_list} FROM arrow_batch"
    )
    records.clear()


def _read_table(
    connection: duckdb.DuckDBPyConnection,
    path: Path,
    table_name: str,
    section_start: int,
    section_end: int,
) -> None:
    """Create ``table_name`` from its declaration and fill it from the rows."""
    column_types = read_column_types(path, table_name, section_start, section_end)
    column_definitions = ", ".join(
        f"{ident(column_name)} {_duckdb_type(ocel_type)}"
        for column_name, ocel_type in column_types.items()
    )
    connection.execute(f"CREATE TABLE {ident(table_name)} ({column_definitions})")

    positional = {f"c{index}": name for index, name in enumerate(column_types)}
    pending_records: list[dict[str, Any]] = []
    for row_element in iter_rows(path, section_start, section_end):
        pending_records.append(
            {positional[str(key)]: value for key, value in row_element.attrib.items()}
        )
        if len(pending_records) >= BATCH_SIZE:
            insert_batch(connection, table_name, pending_records, column_types)
    if pending_records:
        insert_batch(connection, table_name, pending_records, column_types)


def import_extras_xml(path: str | Path, target: DuckDBTarget) -> None:
    """Loads every ``<table name="...">`` of the XML log at ``path`` into a table of that name.

    A deprecated ``<quantity-extension>`` section is read into the quantity tables,
    with a :class:`DeprecationWarning`.
    """
    path = Path(path)
    sections = find_extra_sections(path)
    if not sections:
        return
    legacy_filled: set[str] = set()
    with connect_target(target) as connection:
        for element, table_name, section_start, section_end in sections:
            if element == TABLE_TAG:
                _read_table(connection, path, table_name, section_start, section_end)
                continue
            with (
                path.open("rb") as file,
                mmap.mmap(file.fileno(), 0, access=mmap.ACCESS_READ) as file_bytes,
            ):
                fragment = file_bytes[section_start:section_end]
            legacy_filled |= read_legacy_xml_quantities(fragment, connection)

    if legacy_filled:
        warnings.warn(
            f"The XML <{XML_QUANTITY_EXTENSION}> section is deprecated. It was read "
            f"into {', '.join(repr(table) for table in sorted(legacy_filled))}.",
            DeprecationWarning,
            stacklevel=2,
        )


def _xml_escaped(expression: str) -> str:
    """SQL that escapes a VARCHAR ``expression`` for use inside a double-quoted attribute."""
    for raw, escaped in (
        ("&", "&amp;"),
        ("<", "&lt;"),
        (">", "&gt;"),
        ('"', "&quot;"),
        ("\n", "&#10;"),
        ("\r", "&#13;"),
        ("\t", "&#9;"),
    ):
        expression = f"replace({expression}, '{raw}', '{escaped}')"
    return expression


def _row_sql(con: duckdb.DuckDBPyConnection, table: str) -> tuple[str, str]:
    """The ``<columns>`` declaration of ``table`` and SQL building one ``<row .../>`` per row."""
    columns = table_column_types(con, table)
    declaration = "".join(
        f"<column name={quoteattr(name)} type={quoteattr(duckdb_to_attribute_type(duckdb_type))}/>"
        for name, duckdb_type in columns
    )
    attributes = " || ".join(
        f"CASE WHEN {ident(name)} IS NULL THEN '' "
        f"ELSE ' c{index}=\"' || {_xml_escaped(f'CAST({ident(name)} AS VARCHAR)')} || '\"' END"
        for index, (name, _) in enumerate(columns)
    )
    return (
        f"<columns>{declaration}</columns>",
        f"SELECT '<row' || {attributes} || '/>' FROM {ident(table)}",
    )


def _closing_tag_position(stream, end: int) -> int:
    """Position of the last ``<`` before ``end``: the root's closing tag."""
    chunk = 8192
    while end > 0:
        start = max(0, end - chunk)
        stream.seek(start)
        found = stream.read(end - start).rfind(b"<")
        if found != -1:
            return start + found
        end = start
    raise ValueError("no closing tag in the file")


def export_extras_xml(
    con: duckdb.DuckDBPyConnection, target: str | Path, tables: list[str]
) -> None:
    """Add every table in ``tables`` to the XML log at ``target`` as a ``<table name="...">``.

    The rows are built as text by DuckDB and written in batches just before the
    log's closing tag; the log itself is neither parsed nor rewritten.
    """
    if not tables:
        return
    with open(target, "r+b") as stream:
        stream.seek(0, os.SEEK_END)
        closing_at = _closing_tag_position(stream, stream.tell())
        stream.seek(closing_at)
        closing = stream.read()
        if not closing.startswith(b"</"):
            raise ValueError(f"{target} does not end in a closing tag")
        stream.seek(closing_at)
        stream.truncate()

        for table in tables:
            declaration, row_sql = _row_sql(con, table)
            stream.write(f"<{TABLE_TAG} name={quoteattr(table)}>{declaration}".encode())
            batches = con.execute(row_sql).fetch_record_batch(EXPORT_BATCH_SIZE)
            stream.writelines(
                "".join(cast(list[str], batch.column(0).to_pylist())).encode()
                for batch in batches
            )
            stream.write(f"</{TABLE_TAG}>".encode())
        stream.write(closing)
