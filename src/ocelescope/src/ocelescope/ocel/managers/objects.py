from __future__ import annotations

from typing import Any, Iterable, cast

import duckdb
import pandas as pd
import polars as pl

from ocelescope.ocel.constants.pm4py import (
    OBJECT_CHANGED_FIELD,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.ocel.managers.base import BaseManager
from ocelescope.util.cache import instance_lru_cache

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

    def _attributes(self, table: str) -> list[str]:
        """The attribute columns of a stored table: its columns minus the OCEL ones.

        A table's columns *are* the answer -- ``objects`` has one per attribute and
        ``object_changes`` only keeps the ones that change -- so this reads no rows.
        """
        return sorted(
            name
            for name, *_ in self._ocel.con.execute(f'DESCRIBE "{table}"').fetchall()
            if not name.startswith("ocel:")
        )

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
    def pl(self) -> pl.LazyFrame:
        """
        Return the object table as a polars LazyFrame.

        Nothing is read until it is collected.

        Returns:
            polars.LazyFrame: All objects and their static attributes.
        """
        return self.table.pl(lazy=True)

    @pl.setter
    def pl(self, contents: pl.LazyFrame | pl.DataFrame) -> None:
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
                    f"WHEN c.\"{name}\" IS NOT NULL THEN '{name.replace(chr(39), chr(39) * 2)}'"
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
        self._store_changes(contents)

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
        self._store_changes(contents)

    @property
    def changes_pl(self) -> pl.LazyFrame:
        """
        Return the dynamic object attribute change table as a polars LazyFrame.

        Nothing is read until it is collected.

        Returns:
            polars.LazyFrame: All dynamic updates to object attributes.
        """
        return self.changes_table.pl(lazy=True)

    @changes_pl.setter
    def changes_pl(self, contents: pl.LazyFrame | pl.DataFrame) -> None:
        self._store_changes(contents)

    def _store_changes(self, contents: Any) -> None:
        """Store ``contents`` as the object changes, verbatim but for the derived columns.

        Whatever columns the caller brings are the columns the table gets -- add an
        attribute and it is simply there. The two exceptions are ``ocel:type`` and
        ``ocel:field``, which :attr:`changes_table` computes on the way out; storing
        them back would have the next read derive them a second time, leaving an
        ``ocel:type_1`` behind on every round trip.

        ``COLUMNS(...)`` drops them in SQL rather than here, which also means a
        caller who never had them is not asked to have them.
        """
        self._replace(
            CHANGES_TABLE,
            contents,
            f"COLUMNS(c -> c NOT IN ('{OTYPE_COL}', '{OBJECT_CHANGED_FIELD}'))",
        )

    @property
    @instance_lru_cache()
    def types(self) -> list[str]:
        """
        Return the list of all object types present in the log.

        Returns:
            list[str]: Sorted list of unique object type names.
        """
        return list(sorted(self.df[OTYPE_COL].unique().tolist()))

    @property
    @instance_lru_cache()
    def counts(self) -> pd.Series:
        """
        Count how many objects exist for each object type.

        Returns:
            Series: A pandas Series indexed by object type with occurrence counts.
        """
        return self.df[OTYPE_COL].value_counts()

    @property
    @instance_lru_cache()
    def type_by_id(self) -> pd.Series:
        """
        Return a mapping from object ID to object type.

        Returns:
            Series: A pandas Series indexed by object ID, containing object types as values.
        """
        return cast(pd.Series, self.df[[OID_COL, OTYPE_COL]].set_index(OID_COL)[OTYPE_COL])

    def has_types(self, types: Iterable[str]) -> bool:
        """
        Check whether all provided object types exist in the OCEL.

        Args:
            types: Iterable of object type names to verify.

        Returns:
            bool: True if all types exist, False otherwise.
        """
        return all(ot in self.types for ot in types)

    @property
    def attribute_names(self) -> list[str]:
        """
        Return all object attribute names.

        Every object attribute has a column in the objects table, whether or not
        it ever changes.

        Returns:
            list[str]: Sorted list of all object attribute names.
        """
        return self._attributes(TABLE)

    @property
    def dynamic_attribute_names(self) -> list[str]:
        """
        Return the names of all dynamic object attributes.

        Dynamic attributes are the ones that change, which is exactly what the
        object_changes table stores.

        Returns:
            list[str]: Sorted list of dynamic object attribute names.
        """
        return self._attributes(CHANGES_TABLE)

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

    @property
    @instance_lru_cache()
    def attribute_summary(self) -> pd.DataFrame:
        """Return an attribute summary for objects, grouped by object type.

        RETURNS:
            A pandas DataFrame indexed by (ATTRIBUTE_COL, OTYPE_COL) containing the
            summary statistics produced by `get_summary`.
        """

        return self._ocel.attributes.get_object_summary()

    def object_attr_changes(
        self,
        object_types: Iterable[Any] | None = None,
        objects: Iterable[Any] | None = None,
        attributes: Iterable[Any] | None = None,
    ):
        """
        Return dynamic object attributes over time.

        Filters `object_changes` by object type and/or object id, forward-fills
        attribute values per object, and returns one row per `(object_id, timestamp)`.

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

        changes = self.changes

        mask = pd.Series(True, index=changes.index)

        if object_types is not None:
            mask &= changes[OTYPE_COL].isin(object_types)

        if objects is not None:
            mask &= changes[OID_COL].isin(objects)

        changes = cast(pd.DataFrame, changes.loc[mask])

        changes.sort_values([OID_COL, TIMESTAMP_COL])

        changes[attr_cols] = changes.groupby(OID_COL)[attr_cols].ffill()

        return (
            changes.assign(_nn=changes.notna().sum(axis=1))
            .reset_index()
            .sort_values([TIMESTAMP_COL, OID_COL] + ["_nn"])
            .drop_duplicates(subset=[TIMESTAMP_COL, OID_COL], keep="last")
            .set_index([OID_COL, TIMESTAMP_COL], drop=True)[
                attr_cols
                + [
                    OTYPE_COL,
                ]
            ]
        )
