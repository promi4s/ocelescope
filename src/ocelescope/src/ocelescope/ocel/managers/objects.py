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
from ocelescope.ocel.managers.base import BaseManager
from ocelescope.util.sql import ident, literal

TABLE = "objects"
CHANGES_TABLE = "object_changes"


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
        return self._relation(f"SELECT * FROM {TABLE}")

    @table.setter
    def table(self, contents: Any) -> None:
        self._replace(TABLE, contents)

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
        self._replace(TABLE, contents)

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
        self._replace(TABLE, contents)

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
                    f"WHEN c.{ident(name)} IS NOT NULL THEN {literal(name)}"
                    for name in names
                )
                + " END"
            )
        else:
            field = "NULL"

        return self._relation(
            f'SELECT c.*, o."{OTYPE_COL}", {field} AS "{OBJECT_CHANGED_FIELD}" '
            f"FROM {CHANGES_TABLE} c "
            f'JOIN {TABLE} o ON c."{OID_COL}" = o."{OID_COL}" '
            f'ORDER BY c."{TIMESTAMP_COL}"'
        )

    @changes_table.setter
    def changes_table(self, contents: Any) -> None:
        self._replace(CHANGES_TABLE, contents)

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
        self._replace(CHANGES_TABLE, contents)

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
        self._replace(CHANGES_TABLE, contents)

    @property
    def types(self) -> list[str]:
        """
        Return the list of all object types present in the log.

        Returns:
            list[str]: Sorted list of unique object type names.
        """
        return self._column(f'SELECT DISTINCT "{OTYPE_COL}" FROM {TABLE} ORDER BY 1')

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
            f'SELECT "{OTYPE_COL}", count(*) AS "count" FROM {TABLE} '
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
        mapping = self._relation(f'SELECT "{OID_COL}", "{OTYPE_COL}" FROM {TABLE}').df()
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
            f'SELECT count(DISTINCT "{OTYPE_COL}") FROM {TABLE} '
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
        return self._attribute_names(TABLE)

    @property
    def dynamic_attribute_names(self) -> list[str]:
        """
        Return the names of all dynamic object attributes.

        Dynamic attributes are the ones that change, which is exactly what the
        object_changes table stores.

        Returns:
            list[str]: Sorted list of dynamic object attribute names.
        """
        return self._attribute_names(CHANGES_TABLE)

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

    def object_attr_changes(
        self,
        object_types: Iterable[Any] | None = None,
        objects: Iterable[Any] | None = None,
        attributes: Iterable[Any] | None = None,
    ) -> pd.DataFrame:
        """
        Return dynamic object attributes over time.

        Filters `object_changes` by object type and/or object id, forward-fills
        attribute values per object, and returns one row per `(object_id, timestamp)`.

        Filtering, forward-filling and de-duplication all happen in DuckDB, so only
        the resulting rows are read. A change row holds a single attribute's new
        value, so forward-filling is what turns the log's one-attribute-at-a-time
        rows into the object's full state at each point in time.

        Where several attributes change at the same timestamp the log has one row
        each, and only the last is kept -- forward-filling makes that the one row
        carrying all of them.

        Args:
            object_types: Optional object types to include.
            objects: Optional object ids to include.
            attributes: Optional dynamic attribute names to include. If omitted, all
                dynamic attributes are returned.

        Returns:
            pandas.DataFrame: DataFrame indexed by `(ocel:oid, ocel:timestamp)` with
            the selected dynamic attribute columns and the object type column
            (`ocel:type`).
        """
        attr_cols = [
            attr_name
            for attr_name in self.dynamic_attribute_names
            if attributes is None or attr_name in attributes
        ]

        params: list[object] = []
        conditions: list[str] = []

        def add_filter(column: str, values: Iterable[Any] | None) -> None:
            """Restrict ``column`` to ``values``; None = no filter, empty = nothing."""
            if values is None:
                return
            wanted = list(values)
            if not wanted:
                conditions.append("false")
                return
            params.extend(wanted)
            conditions.append(f"{column} IN ({', '.join(['?'] * len(wanted))})")

        add_filter(f'o."{OTYPE_COL}"', object_types)
        add_filter(f'c."{OID_COL}"', objects)
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        # _rn pins the stored order, to break ties between changes to the same
        # object at the same timestamp -- for the fill order and the row kept.
        selected = "".join(f", c.{ident(name)}" for name in attr_cols)
        source = (
            f'SELECT c."{OID_COL}", c."{TIMESTAMP_COL}", o."{OTYPE_COL}"{selected}, '
            f"row_number() OVER () AS _rn "
            f"FROM {CHANGES_TABLE} c "
            f'JOIN {TABLE} o ON c."{OID_COL}" = o."{OID_COL}" {where}'
        )

        filled = "".join(
            f", last_value({ident(name)} IGNORE NULLS) OVER w AS {ident(name)}"
            for name in attr_cols
        )
        query = (
            f"WITH source AS ({source}), "
            f'filled AS (SELECT "{OID_COL}", "{TIMESTAMP_COL}", "{OTYPE_COL}", _rn{filled} '
            f"FROM source "
            f'WINDOW w AS (PARTITION BY "{OID_COL}" ORDER BY "{TIMESTAMP_COL}", _rn '
            f"ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)) "
            f"SELECT * EXCLUDE (_rn) FROM filled "
            f'QUALIFY row_number() OVER (PARTITION BY "{OID_COL}", "{TIMESTAMP_COL}" '
            f"ORDER BY _rn DESC) = 1 "
            f'ORDER BY "{TIMESTAMP_COL}", "{OID_COL}"'
        )

        frame = self._relation(query, params).df()
        return cast(
            pd.DataFrame,
            frame.set_index([OID_COL, TIMESTAMP_COL], drop=True)[attr_cols + [OTYPE_COL]],
        )
