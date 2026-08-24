from typing import Any, cast

import duckdb
import pandas as pd

from ocelescope.ocel.constants.quantity import (
    QEL_QUANTITY,
    QUANTITIES_TABLE,
    QUANTITY_ITEM_PROPERTIES_TABLE,
    QUANTITY_OPERATIONS_TABLE,
)


def inverse_keymap(keymap: dict[str, str]) -> dict[str, str]:
    """Flip a keymap, to rename a format's names back to ours."""
    return {v: k for k, v in keymap.items()}


def _as_float(values: Any) -> pd.Series:
    """A quantity column as floats, with anything non-numeric turned into NaN."""
    return cast(pd.Series, pd.to_numeric(values, errors="coerce")).astype("float64")


def _write_table(con: duckdb.DuckDBPyConnection, name: str, df: pd.DataFrame) -> None:
    """(Re)create ``name`` on ``con`` from a DataFrame, preserving its columns.

    Registering the frame lets DuckDB read it directly and infer the column
    types; column names carrying colons (e.g. ``qel:quantity``) survive because
    ``SELECT *`` copies them verbatim.
    """
    con.execute(f'DROP TABLE IF EXISTS "{name}"')
    con.register("_quantity_source", df)
    try:
        con.execute(f'CREATE TABLE "{name}" AS SELECT * FROM _quantity_source')
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

    ``quantity`` columns are coerced to floats so numeric text (or ``Decimal``
    from a JSON parse) lands in a numeric column -- a log that writes quantities
    as text would otherwise poison every later comparison and sum. ``float`` (not
    whatever ``to_numeric`` infers) so that a log with whole-number quantities
    still gets the same column type as one with fractional ones, matching the
    ``DOUBLE`` the SQLite importer and the quantity setters store. Item-property
    values keep the types the parser produced.
    """
    oqty[QEL_QUANTITY] = _as_float(oqty[QEL_QUANTITY])
    qop[QEL_QUANTITY] = _as_float(qop[QEL_QUANTITY])

    _write_table(con, QUANTITIES_TABLE, oqty)
    _write_table(con, QUANTITY_OPERATIONS_TABLE, qop)
    _write_table(con, QUANTITY_ITEM_PROPERTIES_TABLE, item_properties)
