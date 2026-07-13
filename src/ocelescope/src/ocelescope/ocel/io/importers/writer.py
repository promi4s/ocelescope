"""Buffered DuckDB sink for OCEL 2.0 logs."""

from __future__ import annotations

from pathlib import Path

import duckdb
import pyarrow as pa

from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    E2O_QUALIFIER,
    EID_COL,
    O2O_QUALIFIER,
    O2O_SOURCE_ID,
    O2O_TARGET_ID,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.ocel.io.schema import (
    SchemaDefinition,
    create_ocel_tables,
)


def _as_strings(values: list) -> list:
    """Render values as strings so DuckDB can cast them into the column type.

    Everything is inserted as ``VARCHAR`` and DuckDB coerces on insert (parsing
    timestamps, numbers and booleans natively), so we only need to turn raw
    scalars into text. Existing strings pass through untouched.
    """
    return [None if v is None else v if type(v) is str else str(v) for v in values]


class OCELWriter:
    """Streams an OCEL 2.0 log into a DuckDB database batch by batch.

    On init it opens ``db_path`` and creates the five (empty) OCEL tables.
    Records added via :meth:`add_object` / :meth:`add_event` are buffered per
    table and flushed to DuckDB once a buffer reaches ``batch_size``, so peak
    memory stays bounded regardless of log size.

    The reader is format agnostic: it consumes plain object/event dicts, so the
    JSON and XML importers share this exact sink.

    Usage::

        with OCELWriter(db_path, object_columns, event_columns) as writer:
            for obj in objects:
                writer.add_object(obj)
            for event in events:
                writer.add_event(event)
    """

    def __init__(
        self,
        db_path: str | Path,
        object_columns: SchemaDefinition,
        event_columns: SchemaDefinition,
        batch_size: int = 100_000,
    ):
        self.con = duckdb.connect(str(db_path))
        self.batch_size = batch_size

        self.schemas = create_ocel_tables(self.con, object_columns, event_columns)
        self.buffers: dict[str, dict[str, list]] = {
            table: {field.name: [] for field in schema} for table, schema in self.schemas.items()
        }

    def add_object(self, obj: dict) -> None:
        """Add one OCEL object, filling the objects, object_changes and o2o tables."""
        object_row = {OID_COL: obj["id"], OTYPE_COL: obj["type"]}

        for attribute in sorted(obj.get("attributes", []), key=lambda a: a["time"]):
            if attribute["name"] not in object_row:
                object_row[attribute["name"]] = attribute["value"]
            else:
                self._add_row(
                    "object_changes",
                    {
                        OID_COL: obj["id"],
                        attribute["name"]: attribute["value"],
                        TIMESTAMP_COL: attribute["time"],
                    },
                )

        for relationship in obj.get("relationships", []):
            self._add_row(
                "o2o",
                {
                    O2O_SOURCE_ID: obj["id"],
                    O2O_QUALIFIER: relationship["qualifier"] or None,
                    O2O_TARGET_ID: relationship["objectId"],
                },
            )

        self._add_row("objects", object_row)

    def add_event(self, event: dict) -> None:
        """Add one OCEL event, filling the events and e2o tables."""
        self._add_row(
            "events",
            {
                EID_COL: event["id"],
                TIMESTAMP_COL: event["time"],
                ACTIVITY_COL: event["type"],
                **{
                    attribute["name"]: attribute["value"]
                    for attribute in event.get("attributes", [])
                },
            },
        )

        for relationship in event.get("relationships", []):
            self._add_row(
                "e2o",
                {
                    EID_COL: event["id"],
                    OID_COL: relationship["objectId"],
                    E2O_QUALIFIER: relationship["qualifier"],
                },
            )

    def _add_row(self, table: str, row: dict) -> None:
        buffer = self.buffers[table]
        for column, values in buffer.items():
            values.append(row.get(column))
        if len(next(iter(buffer.values()))) >= self.batch_size:
            self._flush(table)

    def _flush(self, table: str) -> None:
        buffer = self.buffers[table]
        if not next(iter(buffer.values())):
            return

        arrays = [pa.array(_as_strings(values), type=pa.string()) for values in buffer.values()]
        batch = pa.table(arrays, names=list(buffer))
        self.con.from_arrow(batch).insert_into(table)
        for values in buffer.values():
            values.clear()

    def close(self) -> None:
        """Flush any remaining buffered rows and close the database."""
        for table in self.schemas:
            self._flush(table)
        self.con.close()

    def __enter__(self) -> "OCELWriter":
        return self

    def __exit__(self, *_exc) -> None:
        self.close()
