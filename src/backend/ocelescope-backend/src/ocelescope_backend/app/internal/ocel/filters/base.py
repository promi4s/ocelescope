"""Contract for module filters.

A :class:`ModuleFilter` defines a *view* -- a valid subset of an OCEL -- by
returning the **ids to keep**, expressed with lazy polars over the OCEL tables.
Filters are plain pydantic classes (API-serializable, ``type``-discriminated) and
contain no SQL: each gets the tables as polars ``LazyFrame`` s (backed by DuckDB via
``.pl(lazy=True)``, so predicates/projections push down and nothing is loaded whole)
and returns a ``LazyFrame`` of the surviving event / object ids.

The applier (:mod:`.apply`) intersects those id-frames, collects them, and lets
DuckDB write the filtered file (id membership + a fixed relational cascade), once,
when the pipeline changes -- there is no per-access filtering.
"""

from __future__ import annotations

from abc import ABC

import duckdb
import polars as pl
from ocelescope.ocel.constants.pm4py import OID_COL, OTYPE_COL
from pydantic import BaseModel


class Tables:
    """The OCEL tables a filter may read, as lazy polars frames.

    ``relations`` is the ``e2o`` table with the object ``ocel:type`` joined on;
    ``events``/``objects``/``o2o`` are the flat stored tables. Each access returns a
    *fresh* lazy frame on its own DuckDB cursor -- a single DuckDB connection can't
    be scanned twice in one query, so **always access ``tables.events`` (etc.)
    freshly rather than storing it in a variable and reusing it**.
    """

    def __init__(self, connection: duckdb.DuckDBPyConnection):
        self._con = connection

    @property
    def events(self) -> pl.LazyFrame:
        return self._con.cursor().table("events").pl(lazy=True)

    @property
    def objects(self) -> pl.LazyFrame:
        return self._con.cursor().table("objects").pl(lazy=True)

    @property
    def o2o(self) -> pl.LazyFrame:
        return self._con.cursor().table("o2o").pl(lazy=True)

    @property
    def relations(self) -> pl.LazyFrame:
        return (
            self._con.cursor()
            .sql(
                f'SELECT r.*, o."{OTYPE_COL}" FROM e2o r '
                f'JOIN objects o ON r."{OID_COL}" = o."{OID_COL}"'
            )
            .pl(lazy=True)
        )


class ModuleFilter(BaseModel, ABC):
    """A valid subset of an OCEL, expressed as the event/object ids to keep."""

    def keep_events(self, tables: Tables) -> pl.LazyFrame | None:
        """A single-column frame of event ids to keep, or ``None`` (keep all)."""
        return None

    def keep_objects(self, tables: Tables) -> pl.LazyFrame | None:
        """A single-column frame of object ids to keep, or ``None`` (keep all)."""
        return None
