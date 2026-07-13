"""Apply a stack of :class:`ModuleFilter` s to a DuckDB OCEL, producing a new one.

Runs *once* (when the pipeline changes): reads the tables as lazy polars frames
(``.pl(lazy=True)`` -- predicates/projections push down into DuckDB), asks each
filter for the event/object ids it keeps, intersects them, then hands the surviving
ids to DuckDB, which writes the filtered file via id membership plus a fixed
relational cascade (the SQL counterpart of ocelescope's ``clean_ocel``). Only the
small id-sets cross between polars and DuckDB, so peak memory stays bounded.
"""

from __future__ import annotations

from functools import reduce
from pathlib import Path
from typing import Sequence

import duckdb
import polars as pl
from ocelescope.ocel.constants.pm4py import (
    EID_COL,
    O2O_SOURCE_ID,
    O2O_TARGET_ID,
    OID_COL,
)

from ocelescope_backend.app.internal.ocel.filters.base import ModuleFilter, Tables

SRC = "src"
_QUANTITY_TABLES = ("quantities", "quantity_operations", "quantity_item_properties")


def _table_exists(con: duckdb.DuckDBPyConnection, schema: str, table: str) -> bool:
    return (
        con.execute(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = ? AND table_name = ?",
            [schema, table],
        ).fetchone()
        is not None
    )


def _intersect(
    frames: list[pl.LazyFrame], all_ids: pl.LazyFrame, id_col: str
) -> pl.LazyFrame:
    """Ids kept by *every* frame (inner joins); ``all_ids`` when no frame constrains."""
    if not frames:
        return all_ids
    unique = [frame.select(id_col).unique() for frame in frames]
    return reduce(lambda left, right: left.join(right, on=id_col, how="inner"), unique)


def apply_filters(
    origin_db: str | Path, target_db: str | Path, filters: Sequence[ModuleFilter]
) -> None:
    """Write the filtered subset of ``origin_db`` into a fresh DuckDB at ``target_db``."""
    target_db = Path(target_db)
    target_db.unlink(missing_ok=True)

    con = duckdb.connect(str(origin_db), read_only=True)
    try:
        con.execute("SET TimeZone='UTC'")
        tables = Tables(con)
        event_keeps = [k for f in filters if (k := f.keep_events(tables)) is not None]
        object_keeps = [k for f in filters if (k := f.keep_objects(tables)) is not None]
        kept_events = _intersect(
            event_keeps, tables.events.select(EID_COL), EID_COL
        ).collect()
        kept_objects = _intersect(
            object_keeps, tables.objects.select(OID_COL), OID_COL
        ).collect()
    finally:
        con.close()

    _write(origin_db, target_db, kept_events, kept_objects)


def _write(
    origin_db: str | Path,
    target_db: Path,
    kept_events: pl.DataFrame,
    kept_objects: pl.DataFrame,
) -> None:
    out = duckdb.connect(str(target_db))
    try:
        out.execute("SET TimeZone='UTC'")
        out.execute(f"ATTACH '{origin_db}' AS {SRC} (READ_ONLY)")
        out.register("kept_events", kept_events)
        out.register("kept_objects", kept_objects)

        out.execute(
            f"CREATE TABLE events AS SELECT * FROM {SRC}.events "
            f'WHERE "{EID_COL}" IN (SELECT "{EID_COL}" FROM kept_events)'
        )
        out.execute(
            f"CREATE TABLE objects AS SELECT * FROM {SRC}.objects "
            f'WHERE "{OID_COL}" IN (SELECT "{OID_COL}" FROM kept_objects)'
        )

        # Cascade (== clean_ocel): drop dangling relations, then orphaned entities.
        out.execute(
            f"CREATE TABLE e2o AS SELECT * FROM {SRC}.e2o "
            f'WHERE "{EID_COL}" IN (SELECT "{EID_COL}" FROM events) '
            f'AND "{OID_COL}" IN (SELECT "{OID_COL}" FROM objects)'
        )
        out.execute(
            f"CREATE TABLE o2o AS SELECT * FROM {SRC}.o2o "
            f'WHERE "{O2O_SOURCE_ID}" IN (SELECT "{OID_COL}" FROM objects) '
            f'AND "{O2O_TARGET_ID}" IN (SELECT "{OID_COL}" FROM objects)'
        )
        out.execute(
            f'DELETE FROM objects WHERE "{OID_COL}" NOT IN (SELECT "{OID_COL}" FROM e2o) '
            f'AND "{OID_COL}" NOT IN (SELECT "{O2O_SOURCE_ID}" FROM o2o) '
            f'AND "{OID_COL}" NOT IN (SELECT "{O2O_TARGET_ID}" FROM o2o)'
        )
        out.execute(
            f'DELETE FROM events WHERE "{EID_COL}" NOT IN (SELECT "{EID_COL}" FROM e2o)'
        )
        out.execute(
            f"CREATE TABLE object_changes AS SELECT * FROM {SRC}.object_changes "
            f'WHERE "{OID_COL}" IN (SELECT "{OID_COL}" FROM objects)'
        )

        for table in _QUANTITY_TABLES:
            if _table_exists(out, SRC, table):
                out.execute(f'CREATE TABLE "{table}" AS SELECT * FROM {SRC}."{table}"')
    finally:
        out.close()
