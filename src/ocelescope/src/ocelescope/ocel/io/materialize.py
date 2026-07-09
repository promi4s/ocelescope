"""Materialize an :class:`OCEL` from a flat DuckDB database, and back.

The importers in this package stream an OCEL 2.0 log into the five flat DuckDB
tables (objects, object_changes, o2o, events, e2o) plus the optional quantity
tables. This module is the in-memory bridge:

* :func:`load_ocel_duckdb` reads those tables and reshapes them into the frames an
  :class:`OCEL` is built from -- the same reshaping pm4py's own SQLite importer
  performs (join activity/timestamp/type into the E2O relations, rename the O2O
  columns, and recover ``ocel:field`` / ``ocel:type`` / ``@@cumcount`` for the
  object changes). Events and relations are read in timestamp order to match the
  invariant the file readers guarantee, so the result is equivalent to a normal
  :meth:`OCEL.read`.
* :func:`dump_ocel_duckdb` is the inverse: it writes an already in-memory
  :class:`OCEL` out to the same flat tables, so callers that hold an ``OCEL`` (e.g.
  a plugin result) can persist it without going through a file.

Together with ``convert_ocel_duckdb`` (file -> DuckDB) this lets callers keep OCELs
on disk as DuckDB files and only materialize them on demand.
"""

from __future__ import annotations

from pathlib import Path
from typing import cast

import duckdb
import pandas as pd

from ocelescope.ocel.constants.pm4py import (
    E2O_QUALIFIER,
    EID_COL,
    O2O_QUALIFIER,
    O2O_SOURCE_ID,
    O2O_TARGET_ID,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.ocel.constants.quantity import (
    OQTY_COLUMNS,
    QEL_ITEM_TYPE,
    QEL_QUANTITY,
    QOP_COLUMNS,
)
from ocelescope.ocel.core.ocel import OCEL
from ocelescope.ocel.io.reshape import (
    events_sql,
    o2o_sql,
    object_changes_sql,
    objects_sql,
    relations_sql,
)
from ocelescope.ocel.io.exporters.common import table_exists
from ocelescope.ocel.io.exporters.quantities import (
    QUANTITIES_TABLE,
    QUANTITY_ITEM_PROPERTIES_TABLE,
    QUANTITY_OPERATIONS_TABLE,
)
from ocelescope.ocel.models.meta import OCELMeta

_OBJECT_META = (OID_COL, OTYPE_COL)


def _attribute_columns(
    con: duckdb.DuckDBPyConnection, table: str, meta: tuple[str, ...]
) -> list[str]:
    """The user-attribute columns of ``table`` (its columns minus the meta ones)."""
    names = [row[0] for row in con.execute(f'DESCRIBE "{table}"').fetchall()]
    return [name for name in names if name not in meta]


def _object_changes(con: duckdb.DuckDBPyConnection) -> pd.DataFrame | None:
    """The pm4py object-changes frame, or ``None`` when there are no changes."""
    attr_cols = _attribute_columns(con, "object_changes", (OID_COL, TIMESTAMP_COL))
    changes = con.execute(object_changes_sql(attr_cols)).df()
    return changes if len(changes) else None


def _quantity_extension(
    con: duckdb.DuckDBPyConnection,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame] | None:
    """Read the three quantity tables into the ``(oqty, qop, properties)`` tuple."""
    if not any(
        table_exists(con, table)
        for table in (QUANTITIES_TABLE, QUANTITY_OPERATIONS_TABLE, QUANTITY_ITEM_PROPERTIES_TABLE)
    ):
        return None

    oqty = (
        con.execute(
            f'SELECT "{OID_COL}", "{QEL_ITEM_TYPE}", "{QEL_QUANTITY}" FROM "{QUANTITIES_TABLE}"'
        ).df()
        if table_exists(con, QUANTITIES_TABLE)
        else pd.DataFrame(columns=OQTY_COLUMNS)
    )
    qop = (
        con.execute(
            f'SELECT "{OID_COL}", "{EID_COL}", "{QEL_ITEM_TYPE}", "{QEL_QUANTITY}" '
            f'FROM "{QUANTITY_OPERATIONS_TABLE}"'
        ).df()
        if table_exists(con, QUANTITY_OPERATIONS_TABLE)
        else pd.DataFrame(columns=QOP_COLUMNS)
    )
    properties = (
        con.execute(f'SELECT * FROM "{QUANTITY_ITEM_PROPERTIES_TABLE}"').df()
        if table_exists(con, QUANTITY_ITEM_PROPERTIES_TABLE)
        else pd.DataFrame(columns=[QEL_ITEM_TYPE])
    )
    return oqty, qop, properties


def load_ocel_duckdb(db_path: str | Path, meta: OCELMeta | None = None) -> OCEL:
    """Materialize an :class:`OCEL` from a flat DuckDB database.

    Args:
        db_path: Path to a DuckDB database produced by ``convert_ocel_duckdb`` /
            :func:`dump_ocel_duckdb`.
        meta: Optional metadata to attach to the returned OCEL.

    Returns:
        OCEL: An in-memory OCEL equivalent to reading the original log directly.
    """
    con = duckdb.connect(str(db_path), read_only=True)
    try:
        # DuckDB returns TIMESTAMPTZ values in the session's local zone; pin it to
        # UTC so the materialized frames match a normal file read.
        con.execute("SET TimeZone='UTC'")

        events = con.execute(events_sql()).df()
        objects = con.execute(objects_sql()).df()
        relations = con.execute(relations_sql()).df()
        o2o = con.execute(o2o_sql()).df()
        o2o = o2o if len(o2o) else None
        object_changes = _object_changes(con)
        quantity_extension = _quantity_extension(con)
    finally:
        con.close()

    return OCEL(
        events=events,
        objects=objects,
        relations=relations,
        o2o=o2o,
        object_changes=object_changes,
        meta=meta,
        quantityExtension=quantity_extension,
    )


def _write_table(con: duckdb.DuckDBPyConnection, name: str, frame: pd.DataFrame) -> None:
    """(Re)create ``name`` from ``frame`` on the connection."""
    con.register("_frame", frame)
    con.execute(f'DROP TABLE IF EXISTS "{name}"')
    con.execute(f'CREATE TABLE "{name}" AS SELECT * FROM _frame')
    con.unregister("_frame")


def dump_ocel_duckdb(ocel: OCEL, db_path: str | Path) -> None:
    """Persist an in-memory :class:`OCEL` to the flat DuckDB tables at ``db_path``.

    The inverse of :func:`load_ocel_duckdb`: it projects the OCEL's frames back to
    the flat layout (drop the denormalized/derived columns from the E2O relations
    and object changes, rename the O2O source column) and, if the OCEL carries a
    quantity extension, writes the three quantity tables alongside.
    """
    db_path = Path(db_path)
    db_path.unlink(missing_ok=True)

    object_attrs = [c for c in ocel._objects.columns if c not in _OBJECT_META]

    con = duckdb.connect(str(db_path))
    try:
        con.execute("SET TimeZone='UTC'")

        # E2O_QUALIFIER and O2O_QUALIFIER are the same column name ("ocel:qualifier").
        e2o = cast(pd.DataFrame, ocel._relations[[EID_COL, E2O_QUALIFIER, OID_COL]])
        o2o = cast(pd.DataFrame, ocel._o2o[[OID_COL, O2O_QUALIFIER, O2O_TARGET_ID]]).rename(
            columns={OID_COL: O2O_SOURCE_ID}
        )
        object_changes = cast(
            pd.DataFrame, ocel._object_changes[[OID_COL, TIMESTAMP_COL, *object_attrs]]
        )

        _write_table(con, "events", ocel._events)
        _write_table(con, "objects", ocel._objects)
        _write_table(con, "e2o", e2o)
        _write_table(con, "o2o", o2o)
        _write_table(con, "object_changes", object_changes)

        quantities = ocel.quantities
        if quantities.is_populated():
            _write_table(con, QUANTITIES_TABLE, cast(pd.DataFrame, quantities.oqty[OQTY_COLUMNS]))
            _write_table(
                con, QUANTITY_OPERATIONS_TABLE, cast(pd.DataFrame, quantities.qop[QOP_COLUMNS])
            )
            _write_table(con, QUANTITY_ITEM_PROPERTIES_TABLE, quantities.properties)
    finally:
        con.close()
