from __future__ import annotations

from pathlib import Path
from tempfile import NamedTemporaryFile
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
from ocelescope.ocel.io.connection import DuckDBTarget
from ocelescope.ocel.io.schema import ATTRIBUTE_TYPE_TO_DUCKDB, ensure_ocel_tables
from ocelescope.util.sql import ident, literal, set_utc, utc_timestamp

SRC = "r4pm"
"""Alias the source export is attached under, read-only."""

MetaTable = Literal["object_attr_meta", "event_attr_meta"]


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
        GROUP BY attr_name
        ORDER BY attr_name
    """).fetchall()

    return ",".join(
        f"TRY_CAST({ident(name)} AS {ATTRIBUTE_TYPE_TO_DUCKDB[attr_type]}) AS {ident(name)}"
        for name, attr_type in attr_types
        if attr_type in ATTRIBUTE_TYPE_TO_DUCKDB
    )


def import_ocel_r4pm_streamed(source: Path | str, target: DuckDBTarget) -> None:
    """Build ``target`` from ``source``, replacing any file already there."""

    with NamedTemporaryFile() as fp:
        r4pm.bindings.stream_ocel_to_duckdb(str(source), fp.name)

        with duckdb.connect(str(target)) as con:
            set_utc(con)
            con.execute(f"ATTACH {literal(str(fp.name))} AS {ident(SRC)} (READ_ONLY)")

            con.execute(f"""
                CREATE OR REPLACE TABLE object_changes AS
                SELECT
                id AS {ident(OID_COL)},
                {utc_timestamp("time")} AS {ident(TIMESTAMP_COL)},
                name AS {ident(OBJECT_CHANGED_FIELD)},
                {_attribute_select(con, "object_attr_meta")}
                FROM (
                    PIVOT {ident(SRC)}.object_attribute_changes
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

    with duckdb.connect(str(target)) as con:
        ensure_ocel_tables(con)
