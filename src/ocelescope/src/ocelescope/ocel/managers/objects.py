from __future__ import annotations

from typing import Any, Iterable, cast

import duckdb
import pandas as pd
import polars

from ocelescope.ocel.constants.pm4py import (
    OBJECT_CHANGED_FIELD,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.ocel.constants.tables import OBJECT_CHANGES_TABLE, OBJECTS_TABLE
from ocelescope.ocel.managers.base import BaseManager
from ocelescope.util.sql import ident, literal


class ObjectsManager(BaseManager):
    """
    Manages object-level information within an OCEL instance.

    Provides access to:
    - the objects table
    - the object_changes table
    - object types and counts
    - object attribute names
    - per-object lookup helpers such as type-by-id

    Acts as a facade over the underlying PM4PY OCEL object.
    """

    @property
    def table(self) -> duckdb.DuckDBPyRelation:
        """
        Return the object table as a lazy DuckDB relation.

        Nothing is read until the relation is consumed (``.df()``, ``.pl()``,
        ``.fetchall()`` ...).

        Returns:
            DuckDBPyRelation: A lazy relation over all objects.
        """
        return self._relation(f"SELECT * FROM {OBJECTS_TABLE}")

    @table.setter
    def table(self, contents: Any) -> None:
        self._replace(OBJECTS_TABLE, contents)

    @property
    def df(self) -> pd.DataFrame:
        """
        Return the object table from the underlying OCEL.

        Read from the OCEL's DuckDB database on every access.

        Returns:
            DataFrame: A pandas DataFrame containing all objects and their static attributes.
        """
        return self.table.df()

    @df.setter
    def df(self, contents: pd.DataFrame) -> None:
        self._replace(OBJECTS_TABLE, contents)

    @property
    def pl(self) -> polars.LazyFrame:
        """
        Return the object table as a polars LazyFrame.

        Nothing is read until it is collected.

        Each access is its own scan, bound to its own cursor -- so read it freshly
        at each use rather than storing it in a variable and reusing it. One
        LazyFrame cannot be read twice within a single query.

        Returns:
            polars.LazyFrame: All objects and their static attributes.
        """
        return self.table.pl(lazy=True)

    @pl.setter
    def pl(self, contents: polars.LazyFrame | polars.DataFrame) -> None:
        self._replace(OBJECTS_TABLE, contents)

    @property
    def changes_table(self) -> duckdb.DuckDBPyRelation:
        """
        Return the dynamic object attribute change table as a lazy relation.

        ``ocel:type`` and ``ocel:field`` are derived here (joined on / recovered
        from the changed column) rather than stored, so assigning this table back
        drops them again.

        Returns:
            DuckDBPyRelation: A lazy relation over all dynamic attribute updates.
        """
        names = self.dynamic_attribute_names
        # The stored table is wide with exactly one non-null attribute value per
        # row, so `ocel:field` is the name of whichever column that is.
        if names:
            field = (
                "CASE "
                + " ".join(
                    f"WHEN c.{ident(name)} IS NOT NULL THEN {literal(name)}" for name in names
                )
                + " END"
            )
        else:
            field = "NULL"

        return self._relation(
            f'SELECT c.*, o."{OTYPE_COL}", {field} AS "{OBJECT_CHANGED_FIELD}" '
            f"FROM {OBJECT_CHANGES_TABLE} c "
            f'JOIN {OBJECTS_TABLE} o ON c."{OID_COL}" = o."{OID_COL}" '
            f'ORDER BY c."{TIMESTAMP_COL}"'
        )

    @changes_table.setter
    def changes_table(self, contents: Any) -> None:
        self._replace(OBJECT_CHANGES_TABLE, contents)

    @property
    def changes(self) -> pd.DataFrame:
        """
        Return the dynamic object attribute change table.

        Read from the OCEL's DuckDB database on every access.

        Returns:
            DataFrame: A pandas DataFrame containing all dynamic updates to object attributes.
        """
        return self.changes_table.df()

    @changes.setter
    def changes(self, contents: pd.DataFrame) -> None:
        self._replace(OBJECT_CHANGES_TABLE, contents)

    @property
    def changes_pl(self) -> polars.LazyFrame:
        """
        Return the dynamic object attribute change table as a polars LazyFrame.

        Nothing is read until it is collected.

        Returns:
            polars.LazyFrame: All dynamic updates to object attributes.
        """
        return self.changes_table.pl(lazy=True)

    @changes_pl.setter
    def changes_pl(self, contents: polars.LazyFrame | polars.DataFrame) -> None:
        self._replace(OBJECT_CHANGES_TABLE, contents)

    @property
    def types(self) -> list[str]:
        """
        Return the list of all object types present in the log.

        Returns:
            list[str]: Sorted list of unique object type names.
        """
        return self._column(f'SELECT DISTINCT "{OTYPE_COL}" FROM {OBJECTS_TABLE} ORDER BY 1')

    @property
    def counts(self) -> pd.Series:
        """
        Count how many objects exist for each object type.

        Counted by DuckDB, so only one row per object type is read rather than the
        whole objects table. Ordered like ``value_counts``: most frequent first,
        ties broken by name.

        Returns:
            Series: A pandas Series indexed by object type with occurrence counts.
        """
        counts = self._relation(
            f'SELECT "{OTYPE_COL}", count(*) AS "count" FROM {OBJECTS_TABLE} '
            f'GROUP BY 1 ORDER BY "count" DESC, 1'
        ).df()
        return cast(pd.Series, counts.set_index(OTYPE_COL)["count"])

    @property
    def type_by_id(self) -> pd.Series:
        """
        Return a mapping from object ID to object type.

        Returns:
            Series: A pandas Series indexed by object ID, containing object types as values.
        """
        mapping = self._relation(f'SELECT "{OID_COL}", "{OTYPE_COL}" FROM {OBJECTS_TABLE}').df()
        return cast(pd.Series, mapping.set_index(OID_COL)[OTYPE_COL])

    def has_types(self, types: Iterable[str]) -> bool:
        """
        Check whether all provided object types exist in the OCEL.

        Asked of DuckDB as one count, so this stops at the types named rather than
        collecting every type the log has.

        Args:
            types: Iterable of object type names to verify.

        Returns:
            bool: True if all types exist, False otherwise.
        """
        wanted = set(types)
        if not wanted:
            return True
        placeholders = ", ".join(["?"] * len(wanted))
        found = self._relation(
            f'SELECT count(DISTINCT "{OTYPE_COL}") FROM {OBJECTS_TABLE} '
            f'WHERE "{OTYPE_COL}" IN ({placeholders})',
            list(wanted),
        ).fetchall()[0][0]
        return found == len(wanted)

    @property
    def attribute_names(self) -> list[str]:
        """
        Return all object attribute names.

        Every object attribute has a column in the objects table, whether or not
        it ever changes.

        Returns:
            list[str]: Sorted list of all object attribute names.
        """
        return self._attribute_names(OBJECTS_TABLE)

    @property
    def dynamic_attribute_names(self) -> list[str]:
        """
        Return the names of all dynamic object attributes.

        Dynamic attributes are the ones that change, which is exactly what the
        object_changes table stores.

        Returns:
            list[str]: Sorted list of dynamic object attribute names.
        """
        return self._attribute_names(OBJECT_CHANGES_TABLE)

    @property
    def static_attribute_names(self) -> list[str]:
        """
        Return the names of all static object attributes.

        Static attributes are the ones that never change: every attribute the
        object_changes table does not carry.

        Returns:
            list[str]: Sorted list of static object attribute names.
        """
        dynamic = set(self.dynamic_attribute_names)
        return [name for name in self.attribute_names if name not in dynamic]

    def attribute_states(
        self,
        object_types: Iterable[str] | None = None,
        attributes: Iterable[str] | None = None,
    ) -> pd.DataFrame:
        """
        Return every object's full attribute state at every change timestamp.

        One row per (object, change timestamp), one column per attribute, each
        carrying the attribute's value at that moment -- the value written
        then, or the last earlier one carried forward, starting from the
        initial values in the objects table.

        Args:
            object_types: Object types to include. None means all, an empty
                iterable means none.
            attributes: Attribute names to include. None means all; unknown
                names are ignored.

        Returns:
            DataFrame: A pandas DataFrame with ``ocel:oid``, ``ocel:type``,
            ``ocel:timestamp`` and the selected attribute columns.
        """
        oid, ts, otype = ident(OID_COL), ident(TIMESTAMP_COL), ident(OTYPE_COL)

        type_filter = ""
        params: list[object] = []
        if object_types is not None:
            type_filter = f"WHERE list_contains(?, {otype})"
            params = [list(object_types)]

        if attributes is None:
            kept = self.attribute_names
            object_cols, change_cols = f"* EXCLUDE ({otype})", "*"
        else:
            keep = set(attributes)
            kept = [n for n in self.attribute_names if n in keep]
            dynamic = [n for n in self.dynamic_attribute_names if n in keep]
            object_cols = ", ".join([oid, *map(ident, kept)])
            change_cols = ", ".join([oid, ts, *map(ident, dynamic)])

        collapse = f", any_value(COLUMNS(* EXCLUDE ({oid}, {ts})))" if kept else ""
        fill = f", last_value(COLUMNS(* EXCLUDE ({oid}, {ts})) IGNORE NULLS) OVER w" if kept else ""
        selected = f", s.* EXCLUDE ({oid}, {ts})" if kept else ""

        return self._relation(
            # the objects table, cut down to the wanted types
            f"WITH objs AS (SELECT * FROM {OBJECTS_TABLE} {type_filter}), "
            # t0: just before the first change
            f"bounds AS (SELECT coalesce(min({ts}), TIMESTAMP '1970-01-01') "
            f"- INTERVAL 1 SECOND AS t0 FROM {OBJECT_CHANGES_TABLE}), "
            # stack initial values (at t0) and changes into one stream
            f"source AS (SELECT {object_cols}, (SELECT t0 FROM bounds) AS {ts} "
            f"FROM objs UNION ALL BY NAME "
            f"SELECT {change_cols} FROM {OBJECT_CHANGES_TABLE} "
            f"WHERE {oid} IN (SELECT {oid} FROM objs)), "
            # collapse to one row per (oid, timestamp)
            f"collapsed AS (SELECT {oid}, {ts}{collapse} FROM source GROUP BY ALL), "
            # forward-fill every attribute per object
            f"states AS (SELECT {oid}, {ts}{fill} "
            f"FROM collapsed WINDOW w AS (PARTITION BY {oid} ORDER BY {ts} "
            f"ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)) "
            # add the object type, drop the t0 rows
            f"SELECT s.{oid}, o.{otype}, s.{ts}{selected} "
            f"FROM states s "
            f"JOIN objs o ON s.{oid} = o.{oid} "
            f"CROSS JOIN bounds b "
            f"WHERE s.{ts} > b.t0 "
            f"ORDER BY s.{oid}, s.{ts}",
            params,
        ).df()
