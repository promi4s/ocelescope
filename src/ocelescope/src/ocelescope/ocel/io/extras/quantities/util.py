"""What the readers of every deprecated quantity format share."""

from __future__ import annotations

import duckdb

from ocelescope.ocel.constants.quantity import QEL_QUANTITY
from ocelescope.util.sql import ident


def quantity_as_double(con: duckdb.DuckDBPyConnection, table: str) -> None:
    """Make the quantity column of ``table`` a DOUBLE, whatever the file stored it as.

    Old logs spell quantities as text (``"1.0"``) as often as as numbers; a value
    that is not a number becomes NULL. A table without a quantity column (the item
    properties) is left alone.
    """
    column_types = dict(
        con.execute(
            f"SELECT column_name, column_type FROM (DESCRIBE {ident(table)})"
        ).fetchall()
    )
    if column_types.get(QEL_QUANTITY, "DOUBLE") != "DOUBLE":
        con.execute(
            f"ALTER TABLE {ident(table)} ALTER {ident(QEL_QUANTITY)} "
            f"TYPE DOUBLE USING TRY_CAST({ident(QEL_QUANTITY)} AS DOUBLE)"
        )
