from __future__ import annotations

from typing import Any, Iterable, cast

import duckdb
import pandas as pd
import polars

from ocelescope.ocel.constants.misc import EPOCH_SQL
from ocelescope.ocel.constants.pm4py import (
    OBJECT_CHANGE_CUMCOUNT,
    OBJECT_CHANGED_FIELD,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.ocel.constants.tables import OBJECT_CHANGES_TABLE, OBJECTS_TABLE
from ocelescope.ocel.managers.base import BaseManager
from ocelescope.ocel.util.changes import collapse_object_changes
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

        One row per object, carrying its type and its static attributes. A static
        attribute is stored like any other -- as a row in ``object_changes``,
        timestamped at the epoch -- so the wide table is assembled here rather
        than read, one ``any_value`` per attribute joined back onto every object.

        Nothing is read until the relation is consumed (``.df()``, ``.pl()``,
        ``.fetchall()`` ...).

        Returns:
            DuckDBPyRelation: A lazy relation over all objects.
        """
        oid, otype = ident(OID_COL), ident(OTYPE_COL)

        names = self.static_attribute_names
        if not names:
            return self._relation(f"SELECT * FROM {OBJECTS_TABLE} ORDER BY {otype}, {oid}")

        field = ident(OBJECT_CHANGED_FIELD)
        wanted = ", ".join(literal(name) for name in names)
        values = ", ".join(
            f"any_value({ident(name)}) FILTER (WHERE {field} = {literal(name)}) AS {ident(name)}"
            for name in names
        )
        projection = ", ".join(f"static.{ident(name)}" for name in names)

        return self._relation(
            f"SELECT o.*, {projection} "
            f"FROM (SELECT {oid}, {values} FROM {OBJECT_CHANGES_TABLE} "
            f"WHERE {field} IN ({wanted}) GROUP BY {oid}) static "
            f"RIGHT JOIN {OBJECTS_TABLE} o ON o.{oid} = static.{oid} "
            f"ORDER BY o.{otype}, o.{oid}"
        )

    @table.setter
    def table(self, contents: Any) -> None:
        """Store ``contents`` as the objects table, its attributes going to the changes.

        The objects table itself only keeps the id and the type, so every other
        column of ``contents`` is a static attribute and is written the way the
        importers write one: a change row at the epoch, one per object that has a
        value. This is the inverse of the getter, so a table taken off it can be
        handed straight back.

        The static rows already stored are dropped first -- the objects they
        describe are the ones being replaced. Dynamic attributes are left alone,
        epoch rows included: those are a dynamic attribute's initial value, not
        the object's own column.

        A value is only written where the object has no history of that attribute
        at all. Tools that keep an attribute's first value in both tables (PM4PY
        and r4pm do) would otherwise have it stored twice: once at its own time,
        once more at the epoch, as a change that never happened.
        """
        oid, otype = ident(OID_COL), ident(OTYPE_COL)
        ts, field = ident(TIMESTAMP_COL), ident(OBJECT_CHANGED_FIELD)
        con = self._ocel.con

        with self._bound(contents) as incoming:
            # a fresh database has no change table until something is stored
            if not self._has_table(OBJECT_CHANGES_TABLE):
                con.execute(
                    f"CREATE TABLE {OBJECT_CHANGES_TABLE} "
                    f"({oid} VARCHAR, {ts} TIMESTAMP, {field} VARCHAR)"
                )

            stale = self.static_attribute_names
            if stale:
                con.execute(
                    f"DELETE FROM {OBJECT_CHANGES_TABLE} WHERE {field} IN "
                    f"({', '.join(literal(name) for name in stale)})"
                )

            columns = [
                (name, dtype)
                for name, dtype, *_ in con.execute(f"DESCRIBE {incoming}").fetchall()
                if name not in (OID_COL, OTYPE_COL)
            ]
            for name, dtype in columns:
                con.execute(
                    f"ALTER TABLE {OBJECT_CHANGES_TABLE} "
                    f"ADD COLUMN IF NOT EXISTS {ident(name)} {dtype}"
                )
                con.execute(
                    f"INSERT INTO {OBJECT_CHANGES_TABLE} BY NAME "
                    f"SELECT {oid}, {EPOCH_SQL} AS {ts}, {literal(name)} AS {field}, {ident(name)} "
                    f"FROM {incoming} i WHERE i.{ident(name)} IS NOT NULL "
                    f"AND NOT EXISTS (SELECT 1 FROM {OBJECT_CHANGES_TABLE} c "
                    f"WHERE c.{oid} = i.{oid} AND c.{field} = {literal(name)})"
                )

            con.execute(
                f"CREATE OR REPLACE TABLE {OBJECTS_TABLE} AS SELECT {oid}, {otype} FROM {incoming}"
            )

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
        self.table = contents

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
        self.table = contents

    @property
    def changes_table(self) -> duckdb.DuckDBPyRelation:
        """
        Return the object attribute change table as a lazy relation.

        Every attribute value the log holds is a row here, static ones included:
        those are written once, at the epoch, and are also the objects table's own
        columns (see :attr:`table`).

        Returns:
            DuckDBPyRelation: A lazy relation over all object attribute changes.
        """
        oid, ts = ident(OID_COL), ident(TIMESTAMP_COL)
        field, otype = ident(OBJECT_CHANGED_FIELD), ident(OTYPE_COL)

        return self._relation(
            f"SELECT {oid}, o.{otype}, c.{ts}, c.{field}, "
            f"c.* EXCLUDE ({oid}, {ts}, {field}) "
            f"FROM {OBJECT_CHANGES_TABLE} c "
            f"JOIN {OBJECTS_TABLE} o USING ({oid}) "
            f"ORDER BY c.{ts}"
        )

    @changes_table.setter
    def changes_table(self, contents: Any) -> None:
        """Store ``contents`` as the change table, one attribute value per row.

        The whole table is replaced, static rows included, so what the setter
        stores is exactly what the getter reports.

        ``contents`` is normalized on the way in, which is what lets a table from
        another tool be handed over as it comes:

        * a row that names no ``ocel:field`` is split into one row per value it
          carries, each naming its own attribute -- a wide row holding several
          values is several changes, and stored as one it would be unreadable,
          the field being what says which column a row wrote,
        * a row with no timestamp is written at the epoch, where an initial value
          with no time of its own belongs (see :attr:`static_attribute_names`);
          the column is stored at the schema's microsecond precision however fine
          the contents keep it,
        * one row is kept per object, attribute and timestamp: an attribute holds
          one value at one moment, so rows that agree on all three are the same
          change written twice.

        ``ocel:type`` and PM4PY's ``@@cumcount`` are dropped. The getters join the
        type on rather than reading it from the table, so a table taken off one of
        them can be handed straight back, and the cumcount is PM4PY's own row
        counter rather than anything the log holds. The lambda leaves contents
        that carry neither alone.
        """
        oid, ts = ident(OID_COL), ident(TIMESTAMP_COL)
        field = ident(OBJECT_CHANGED_FIELD)
        con = self._ocel.con

        with self._bound(contents) as incoming:
            dropped = [OTYPE_COL, OBJECT_CHANGE_CUMCOUNT]
            meta = [OID_COL, TIMESTAMP_COL, OBJECT_CHANGED_FIELD, *dropped]
            columns = [name for name, *_ in con.execute(f"DESCRIBE {incoming}").fetchall()]
            names = [name for name in columns if name not in meta]

            kept = f"COLUMNS(c -> c NOT IN ({', '.join(literal(name) for name in dropped)}))"
            # a table that leaves a column out says the same as one holding NULLs
            absent = "".join(
                f", NULL::{dtype} AS {ident(column)}"
                for column, dtype in (
                    (TIMESTAMP_COL, "TIMESTAMP"),
                    (OBJECT_CHANGED_FIELD, "VARCHAR"),
                )
                if column not in columns
            )
            source = f"(SELECT {kept}{absent} FROM {incoming})"

            # the rows that name their field, which also settles the stored types
            con.execute(
                f"CREATE OR REPLACE TABLE {OBJECT_CHANGES_TABLE} AS "
                f"SELECT * REPLACE (coalesce({ts}, {EPOCH_SQL})::TIMESTAMP AS {ts}) "
                f"FROM {source} WHERE {field} IS NOT NULL"
            )

            for name in names:
                con.execute(
                    f"INSERT INTO {OBJECT_CHANGES_TABLE} BY NAME SELECT {oid}, "
                    f"coalesce({ts}, {EPOCH_SQL})::TIMESTAMP AS {ts}, {literal(name)} AS {field}, {ident(name)} "
                    f"FROM {source} WHERE {field} IS NULL AND {ident(name)} IS NOT NULL"
                )

            collapse_object_changes(con)

    @property
    def changes(self) -> pd.DataFrame:
        """
        Return the object attribute change table.

        Read from the OCEL's DuckDB database on every access.

        Returns:
            DataFrame: A pandas DataFrame containing every update to an object attribute.
        """
        return self.changes_table.df()

    @changes.setter
    def changes(self, contents: pd.DataFrame) -> None:
        self.changes_table = contents

    @property
    def changes_pl(self) -> polars.LazyFrame:
        """
        Return the object attribute change table as a polars LazyFrame.

        Nothing is read until it is collected.

        Returns:
            polars.LazyFrame: Every update to an object attribute.
        """
        return self.changes_table.pl(lazy=True)

    @changes_pl.setter
    def changes_pl(self, contents: polars.LazyFrame | polars.DataFrame) -> None:
        self.changes_table = contents

    @property
    def types(self) -> list[str]:
        """
        Return the list of all object types present in the log.

        Returns:
            list[str]: Sorted list of unique object type names.
        """
        return self._column(f'SELECT DISTINCT "{OTYPE_COL}" FROM {OBJECTS_TABLE} ORDER BY 1')

    @property
    def count(self) -> int:
        """
        Return the number of events in the log.

        Returns:
            int: The number of distinct events.
        """
        return self._relation(
            f'SELECT count(DISTINCT "{OID_COL}") FROM {OBJECTS_TABLE}'
        ).fetchall()[0][0]

    @property
    def counts(self) -> pd.Series:
        """
        Count how many objects exist for each object type.

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

        Every object attribute is named by the ``ocel:field`` of the change rows
        that write it, whether or not it ever changes.

        Returns:
            list[str]: Sorted list of all object attribute names.
        """
        field = ident(OBJECT_CHANGED_FIELD)

        names = self._relation(
            f"SELECT DISTINCT {field} FROM {OBJECT_CHANGES_TABLE} ORDER BY {field}"
        ).fetchall()

        return [name for (name,) in names]

    @property
    def dynamic_attribute_names(self) -> list[str]:
        """
        Return the names of all dynamic object attributes.

        Dynamic attributes are the ones that change: those the object_changes
        table writes at a real timestamp rather than only at the epoch.

        Returns:
            list[str]: Sorted list of dynamic object attribute names.
        """
        field = ident(OBJECT_CHANGED_FIELD)
        ts = ident(TIMESTAMP_COL)

        names = self._relation(
            f"SELECT {field} FROM {OBJECT_CHANGES_TABLE} "
            f"GROUP BY {field} "
            f"HAVING max({ts}) > {EPOCH_SQL} "
            f"ORDER BY {field}"
        ).fetchall()

        return [name for (name,) in names]

    @property
    def static_attribute_names(self) -> list[str]:
        """
        Return the names of all static object attributes.

        Static attributes are the ones that never change: those the
        object_changes table only ever writes at the epoch, which is where an
        initial value with no time of its own is recorded.

        Returns:
            list[str]: Sorted list of static object attribute names.
        """
        field = ident(OBJECT_CHANGED_FIELD)
        ts = ident(TIMESTAMP_COL)

        names = self._relation(
            f"SELECT {field} FROM {OBJECT_CHANGES_TABLE} "
            f"GROUP BY {field} "
            f"HAVING max({ts}) = {EPOCH_SQL} "
            f"ORDER BY {field}"
        ).fetchall()
        return [name for (name,) in names]

    def attribute_states(
        self,
        object_types: Iterable[str] | None = None,
        attributes: Iterable[str] | None = None,
    ) -> duckdb.DuckDBPyRelation:
        """
        Return every object's full attribute state at every change timestamp.

        One row per (object, change timestamp), one column per attribute, each
        carrying the attribute's value at that moment -- the value written then,
        or the last earlier one carried forward. An initial value with no time of
        its own is written at the epoch, so it is the first row of its object.

        Nothing is read until the relation is consumed: ``.df()`` for pandas,
        ``.pl()`` for polars, ``.fetchall()`` for rows.

        Args:
            object_types: Object types to include. None means all, an empty
                iterable means none.
            attributes: Attribute names to include. None means all; unknown
                names are ignored.

        Returns:
            DuckDBPyRelation: A lazy relation with ``ocel:oid``, ``ocel:type``,
            ``ocel:timestamp`` and the selected attribute columns.
        """
        oid, ts, otype = ident(OID_COL), ident(TIMESTAMP_COL), ident(OTYPE_COL)

        type_filter = ""
        params: list[object] = []
        if object_types is not None:
            type_filter = f"WHERE list_contains(?, {otype})"
            params = [list(object_types)]

        names = self.attribute_names
        if attributes is not None:
            keep = set(attributes)
            names = [name for name in names if name in keep]

        meta = f"{oid}, {otype}, {ts}"
        columns = "".join(f", c.{ident(name)}" for name in names)
        collapse = f", any_value(COLUMNS(* EXCLUDE ({meta})))" if names else ""
        fill = f", last_value(COLUMNS(* EXCLUDE ({meta})) IGNORE NULLS) OVER w" if names else ""

        return self._relation(
            # the objects table, cut down to the wanted types
            f"WITH objs AS (SELECT {oid}, {otype} FROM {OBJECTS_TABLE} {type_filter}), "
            # collapse to one row per (oid, timestamp), the type carried along
            f"collapsed AS (SELECT {meta}{collapse} FROM "
            f"(SELECT c.{oid}, o.{otype}, c.{ts}{columns} "
            f"FROM {OBJECT_CHANGES_TABLE} c JOIN objs o USING ({oid})) "
            f"GROUP BY {meta}) "
            # forward-fill every attribute per object
            f"SELECT {meta}{fill} FROM collapsed "
            f"WINDOW w AS (PARTITION BY {oid} ORDER BY {ts} "
            f"ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) "
            f"ORDER BY {ts}, {oid}",
            params,
        )
