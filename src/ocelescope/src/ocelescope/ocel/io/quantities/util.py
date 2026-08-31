import duckdb
import pandas as pd

from ocelescope.ocel.constants.quantity import (
    QUANTITIES_TABLE,
    QUANTITY_ITEM_PROPERTIES_TABLE,
    QUANTITY_OPERATIONS_TABLE,
)
from ocelescope.ocel.io.schema import FIXED_COLUMN_TYPES
from ocelescope.util.sql import ident


def inverse_keymap(keymap: dict[str, str]) -> dict[str, str]:
    """Flip a keymap, to rename a format's names back to ours."""
    return {v: k for k, v in keymap.items()}


def _write_table(con: duckdb.DuckDBPyConnection, name: str, df: pd.DataFrame) -> None:
    """(Re)create ``name`` on ``con`` from a DataFrame, with its fixed columns pinned."""
    pinned = ", ".join(
        f"TRY_CAST({ident(column)} AS {dtype}) AS {ident(column)}"
        for column, dtype in FIXED_COLUMN_TYPES.get(name, {}).items()
        if column in df.columns
    )
    replace = f" REPLACE ({pinned})" if pinned else ""

    con.execute(f"DROP TABLE IF EXISTS {ident(name)}")
    con.register("_quantity_source", df)
    try:
        con.execute(f"CREATE TABLE {ident(name)} AS SELECT *{replace} FROM _quantity_source")
    finally:
        con.unregister("_quantity_source")


def fetch_dicts(con: duckdb.DuckDBPyConnection, sql: str) -> list[dict]:
    """Run ``sql`` and return its rows as dicts keyed by the selected column names."""
    result = con.execute(sql)
    names = [description[0] for description in result.description]
    return [dict(zip(names, row)) for row in result.fetchall()]


def write_quantity_frames(
    con: duckdb.DuckDBPyConnection,
    oqty: pd.DataFrame,
    qop: pd.DataFrame,
    item_properties: pd.DataFrame,
) -> None:
    """Persist the three extension frames as DuckDB tables.

    Every importer lands the same column types, whatever its format spelled them
    as -- see :func:`_write_table`.
    """
    _write_table(con, QUANTITIES_TABLE, oqty)
    _write_table(con, QUANTITY_OPERATIONS_TABLE, qop)
    _write_table(con, QUANTITY_ITEM_PROPERTIES_TABLE, item_properties)
