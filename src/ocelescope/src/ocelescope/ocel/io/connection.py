"""Address a DuckDB database either by path or by an already-open connection.

The importers write into a *target*: usually a file path, but optionally a
connection the caller already holds. The distinction matters for in-memory
databases -- DuckDB destroys one as soon as its last connection closes, so an
importer that opened and closed its own connection would leave the caller with
nothing. Borrowing the caller's connection keeps the database alive for as long
as the caller needs it (see :meth:`ocelescope.OCEL.read`).
"""

from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

import duckdb

DuckDBTarget = str | Path | duckdb.DuckDBPyConnection


@contextmanager
def connect_target(
    target: DuckDBTarget, read_only: bool = False
) -> Iterator[duckdb.DuckDBPyConnection]:
    """Yield a connection to ``target``, closing it only if we opened it.

    A path is opened here and closed on exit. A connection is borrowed and left
    open for its owner.

    ``read_only`` applies only when opening a path -- a borrowed connection is
    however its owner opened it.
    """
    if isinstance(target, duckdb.DuckDBPyConnection):
        yield target
        return

    con = duckdb.connect(str(target), read_only=read_only)
    try:
        yield con
    finally:
        con.close()
