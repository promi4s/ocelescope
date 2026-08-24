from __future__ import annotations

from pathlib import Path
from tempfile import NamedTemporaryFile, TemporaryDirectory
from typing import Literal

import duckdb
import r4pm

from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    E2O_QUALIFIER,
    EID_COL,
    O2O_QUALIFIER,
    O2O_SOURCE_ID,
    O2O_TARGET_ID,
    OBJECT_CHANGED_FIELD,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.ocel.constants.tables import (
    E2O_TABLE,
    EVENTS_TABLE,
    O2O_TABLE,
    OBJECT_CHANGES_TABLE,
    OBJECTS_TABLE,
)
from ocelescope.ocel.io.connection import DuckDBTarget, connect_target
from ocelescope.ocel.io.schema import ATTRIBUTE_TYPE_TO_DUCKDB, ensure_ocel_tables
from ocelescope.util.sql import ident, literal, utc_timestamp

SRC = "r4pm"
"""Alias the source export is attached under, read-only."""

MetaTable = Literal["object_attr_meta", "event_attr_meta"]

OUT = "out"
"""Alias the r4pm database being written is attached under."""

NO_ATTRIBUTE = "__r4pm_no_attribute"
"""Placeholder column that keeps an UNPIVOT legal on a table with no attributes."""

IGNORED_ATTRIBUTES = ("@@cumcount",)
"""Attribute names r4pm keeps for its own bookkeeping, dropped on the way in.

Neither their declarations nor their values reach the flat tables, so they also
never come back out on export.
"""


def _not_ignored(column: str) -> str:
    """A predicate on ``column`` that excludes :data:`IGNORED_ATTRIBUTES`."""
    if not IGNORED_ATTRIBUTES:
        return "TRUE"
    return f"{ident(column)} NOT IN ({', '.join(literal(name) for name in IGNORED_ATTRIBUTES)})"


def _attribute_select(con: duckdb.DuckDBPyConnection, meta_table: MetaTable) -> str:
    """The attribute columns of one table, as ``TRY_CAST(...) AS name`` items.

    A name declared under several object/event types can carry several declared
    types; the flat table has one column per name, so a clash collapses to
    ``string`` -- the same fallback :func:`~ocelescope.ocel.io.schema.merge_columns`
    applies on import. A value that will not convert becomes NULL rather than
    failing the whole load, matching how the importers read attribute values.
    """
    attr_types = con.execute(f"""
        SELECT
            attr_name,
            if(count(DISTINCT attr_type) > 1, 'string', first(attr_type)) AS attr_type
        FROM {ident(SRC)}.{ident(meta_table)}
        WHERE {_not_ignored("attr_name")}
        GROUP BY attr_name
        ORDER BY attr_name
    """).fetchall()

    return ",".join(
        f"TRY_CAST({ident(name)} AS {ATTRIBUTE_TYPE_TO_DUCKDB[attr_type]}) AS {ident(name)}"
        for name, attr_type in attr_types
        if attr_type in ATTRIBUTE_TYPE_TO_DUCKDB
    )


def import_ocel_r4pm_streamed(source: Path | str, target: DuckDBTarget) -> None:
    """Build ``target`` from ``source``, replacing any tables already there.

    Args:
        source: Path to an OCEL 2.0 log in any format r4pm reads.
        target: Path of the DuckDB database to write into, or an open connection
            to one -- which is what :meth:`ocelescope.OCEL.read` hands over, and
            what keeps an in-memory database alive past this call.
    """

    with NamedTemporaryFile() as fp:
        r4pm.bindings.stream_ocel_to_duckdb(str(source), fp.name)

        with connect_target(target) as con:
            con.execute(f"ATTACH {literal(str(fp.name))} AS {ident(SRC)} (READ_ONLY)")

            con.execute(f"""
                CREATE OR REPLACE TABLE object_changes AS
                SELECT
                id AS {ident(OID_COL)},
                {utc_timestamp("time")} AS {ident(TIMESTAMP_COL)},
                name AS {ident(OBJECT_CHANGED_FIELD)},
                {_attribute_select(con, "object_attr_meta")}
                FROM (
                    PIVOT (
                        SELECT * FROM {ident(SRC)}.object_attribute_changes
                        WHERE {_not_ignored("name")}
                    )
                    ON name
                    USING max(nullif(value, ''))
                    GROUP BY (id, time, name)
                )
            """)

            con.execute(f"""
                CREATE OR REPLACE TABLE events AS
                SELECT
                id AS {ident(EID_COL)},
                ocel_type AS {ident(ACTIVITY_COL)},
                {utc_timestamp("time")} AS {ident(TIMESTAMP_COL)},
                {_attribute_select(con, "event_attr_meta")}
                FROM {ident(SRC)}.events
            """)

            con.execute(f"""
                CREATE OR REPLACE TABLE objects AS
                SELECT id AS {ident(OID_COL)}, ocel_type AS {ident(OTYPE_COL)}
                FROM {ident(SRC)}.objects
            """)

            con.execute(f"""
                CREATE OR REPLACE TABLE o2o AS
                SELECT
                    source_id AS {ident(O2O_SOURCE_ID)},
                    qualifier AS {ident(O2O_QUALIFIER)},
                    target_id AS {ident(O2O_TARGET_ID)}
                FROM {ident(SRC)}.o2o
            """)

            con.execute(f"""
                CREATE OR REPLACE TABLE e2o AS
                SELECT
                    event_id AS {ident(EID_COL)},
                    qualifier AS {ident(E2O_QUALIFIER)},
                    object_id AS {ident(OID_COL)}
                FROM {ident(SRC)}.e2o
            """)

            con.execute(f"DETACH {ident(SRC)}")

            ensure_ocel_tables(con)


def with_attr_meta(table: Literal["objects", "events"]) -> str:
    """A CTE naming every attribute column of one flat table with its OCEL type.

    r4pm stores an attribute's type as an OCEL type string, so the DuckDB column
    types map back the way :func:`~ocelescope.ocel.io.exporters.common.duckdb_type_to_ocel`
    maps them -- anything unrecognised falls back to ``string``. Object attributes
    are read off ``object_changes``: ``objects`` carries only id and type.
    """
    flat_table = OBJECT_CHANGES_TABLE if table == "objects" else EVENTS_TABLE
    meta_columns = (
        (OID_COL, TIMESTAMP_COL, OBJECT_CHANGED_FIELD)
        if table == "objects"
        else (EID_COL, ACTIVITY_COL, TIMESTAMP_COL)
    )

    return f"""
        attr_meta_map as (
            SELECT
            "name" as attr_name,
            CASE
                WHEN "type" = 'DOUBLE' THEN 'float'
                WHEN "type" = 'BOOLEAN' THEN 'boolean'
                WHEN "type" = 'BIGINT' THEN 'integer'
                WHEN "type" = 'TIMESTAMP' THEN 'time'
                ELSE 'string'
            END as attr_type
            FROM
            pragma_table_info({literal(flat_table)})
            WHERE
            "name" not in ({", ".join(literal(column) for column in meta_columns)})
        )
    """


def _r4pm_timestamp(expr: str) -> str:
    """Read ``expr`` -- a zone-less UTC timestamp -- as the TIMESTAMPTZ r4pm stores.

    The inverse of :func:`~ocelescope.util.sql.utc_timestamp`, which is how the
    import direction drops the zone again.
    """
    return f"{expr} AT TIME ZONE 'UTC'"


def export_ocel_r4pm_stream(source: DuckDBTarget, target: str | Path) -> None:
    """Write the flat OCEL tables at ``source`` into an r4pm DuckDB log at ``target``.

    The inverse of :func:`import_ocel_r4pm_streamed`: it produces the seven tables
    of r4pm's consolidated schema -- the layout ``stream_ocel_to_duckdb`` writes and
    ``read_consolidated_ocel_from_duckdb`` reads -- so r4pm can take the result from
    here and write any OCEL 2.0 format from it.

    Args:
        source: Path to a DuckDB database holding the flat OCEL tables, or an open
            connection to one (e.g. an :class:`ocelescope.OCEL`'s own). It must be
            writable: the output is attached to it and filled by ``CREATE TABLE AS``.
        target: Output path for the r4pm database, replaced if it is already there.
    """

    with TemporaryDirectory() as tmp:
        r4pm_file = Path(tmp) / "ocel.duckdb"

        with connect_target(source) as con:
            con.execute(f"ATTACH {literal(str(r4pm_file))} AS {ident(OUT)}")
            try:
                con.execute(f"""
                    CREATE TABLE {ident(OUT)}.objects AS
                    SELECT
                    {ident(OID_COL)} AS id,
                    {ident(OTYPE_COL)} AS ocel_type
                    FROM {ident(OBJECTS_TABLE)}
                """)

                con.execute(f"""
                    CREATE TABLE {ident(OUT)}.events AS
                    SELECT
                    {ident(EID_COL)} AS id,
                    {ident(ACTIVITY_COL)} AS ocel_type,
                    {_r4pm_timestamp(ident(TIMESTAMP_COL))} AS time,
                    * EXCLUDE ({ident(EID_COL)}, {ident(ACTIVITY_COL)}, {ident(TIMESTAMP_COL)})
                    FROM {ident(EVENTS_TABLE)}
                """)

                con.execute(f"""
                    CREATE TABLE {ident(OUT)}.o2o AS
                    SELECT DISTINCT
                    {ident(O2O_SOURCE_ID)} AS source_id,
                    {ident(O2O_TARGET_ID)} AS target_id,
                    {ident(O2O_QUALIFIER)} AS qualifier
                    FROM {ident(O2O_TABLE)}
                    WHERE {ident(O2O_SOURCE_ID)} IN (SELECT {ident(OID_COL)} FROM {ident(OBJECTS_TABLE)})
                      AND {ident(O2O_TARGET_ID)} IN (SELECT {ident(OID_COL)} FROM {ident(OBJECTS_TABLE)})
                """)

                con.execute(f"""
                    CREATE TABLE {ident(OUT)}.e2o AS
                    SELECT DISTINCT
                    {ident(EID_COL)} AS event_id,
                    {ident(OID_COL)} AS object_id,
                    {ident(E2O_QUALIFIER)} AS qualifier
                    FROM {ident(E2O_TABLE)}
                    WHERE {ident(EID_COL)} IN (SELECT {ident(EID_COL)} FROM {ident(EVENTS_TABLE)})
                      AND {ident(OID_COL)} IN (SELECT {ident(OID_COL)} FROM {ident(OBJECTS_TABLE)})
                """)

                con.execute(f"""
                    CREATE TABLE {ident(OUT)}.object_attribute_changes AS
                    WITH
                        {with_attr_meta("objects")}
                    SELECT
                    oc.id,
                    oc."name",
                    oc."time",
                    oc."value",
                    amm.attr_type as value_type
                    FROM
                    (
                        SELECT
                        {ident(OID_COL)} as id,
                        {_r4pm_timestamp(ident(TIMESTAMP_COL))} as "time",
                        "name",
                        coalesce("value", '') as "value"
                        FROM
                        (
                            FROM
                            (SELECT *, NULL::VARCHAR AS {ident(NO_ATTRIBUTE)} FROM {ident(OBJECT_CHANGES_TABLE)})
                            UNPIVOT INCLUDE NULLS (
                            value FOR name IN (COLUMNS (* EXCLUDE ({ident(OID_COL)}, {ident(TIMESTAMP_COL)}, {ident(OBJECT_CHANGED_FIELD)}))::VARCHAR)
                            )
                        )
                        WHERE
                        {ident(OBJECT_CHANGED_FIELD)} = "name"
                    ) oc
                    JOIN attr_meta_map as amm on oc."name" = amm.attr_name
                """)

                con.execute(f"""
                    CREATE TABLE {ident(OUT)}.object_attr_meta AS
                    WITH
                        {with_attr_meta("objects")}
                    SELECT
                    object_type,
                    attr_name,
                    attr_type
                    FROM
                    (
                        SELECT DISTINCT
                        o.{ident(OTYPE_COL)} as object_type,
                        c.{ident(OBJECT_CHANGED_FIELD)} as "attr_name"
                        FROM
                        {ident(OBJECT_CHANGES_TABLE)} c
                        JOIN {ident(OBJECTS_TABLE)} o USING ({ident(OID_COL)})
                    )
                    JOIN attr_meta_map USING ("attr_name")
                """)

                con.execute(f"""
                    CREATE TABLE {ident(OUT)}.event_attr_meta AS
                    WITH
                        {with_attr_meta("events")}
                    SELECT
                    event_type,
                    attr_name,
                    attr_type
                    FROM
                    (
                        SELECT DISTINCT
                        {ident(ACTIVITY_COL)} as event_type,
                        "name" as "attr_name"
                        FROM
                        (
                            UNPIVOT (
                            SELECT
                                {ident(ACTIVITY_COL)},
                                NULL::VARCHAR AS {ident(NO_ATTRIBUTE)},
                                COLUMNS (* EXCLUDE ({ident(EID_COL)}, {ident(TIMESTAMP_COL)}, {ident(ACTIVITY_COL)}))::VARCHAR
                            FROM
                                {ident(EVENTS_TABLE)}
                            ) ON COLUMNS (* EXCLUDE ({ident(ACTIVITY_COL)}))
                        )
                    )
                    JOIN attr_meta_map USING ("attr_name")
                """)
            finally:
                con.execute(f"DETACH {ident(OUT)}")

        ocel = r4pm.bindings.read_consolidated_ocel_from_duckdb(str(r4pm_file))
        r4pm.export_item(ocel, str(target))
