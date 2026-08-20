from typing import Any, Literal, cast

import pandas as pd
from duckdb import DuckDBPyRelation

from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, EID_COL, OID_COL, OTYPE_COL, TIMESTAMP_COL
from ocelescope.ocel.constants.quantity import (
    QEL_ITEM_TYPE,
    QEL_QUANTITY,
    QUANTITIES_TABLE,
    QUANTITY_ITEM_PROPERTIES_TABLE,
    QUANTITY_OPERATIONS_TABLE,
)
from ocelescope.ocel.constants.tables import E2O_TABLE, EVENTS_TABLE, OBJECTS_TABLE
from ocelescope.ocel.managers.base import BaseManager
from ocelescope.util.sql import first_column_list, ident, literal


class QuantityManager(BaseManager):
    """The quantity extension of an OCEL: item levels carried by objects, changed by events.

    Two tables back it. ``oqty`` holds what an object carries before any event
    touches it, ``qop`` the change one event makes to one object's item type, and
    ``properties`` describes the item types themselves. Everything else here reads
    off those two -- who is involved in a quantity, and how an object's level
    develops over time.
    """

    @property
    def oqty(self) -> pd.DataFrame:
        """Initial quantities per object and item type.

        Returns:
            DataFrame: One row per object and item type, with the quantity the
            object carries before any event touches it.
        """
        return self._relation(f"""SELECT * FROM {QUANTITIES_TABLE}""").df()

    @oqty.setter
    def oqty(self, contents: Any) -> None:
        """Store ``contents`` as the initial quantities, replacing what is there."""
        self._replace(QUANTITIES_TABLE, contents)

    @property
    def qop(self) -> pd.DataFrame:
        """Quantity operations per event, object and item type.

        Returns:
            DataFrame: One row per event, object and item type, with the change
            that event makes to that quantity.
        """
        return self._relation(f"""SELECT * FROM {QUANTITY_OPERATIONS_TABLE}""").df()

    @qop.setter
    def qop(self, contents: Any) -> None:
        """Store ``contents`` as the quantity operations, replacing what is there."""
        self._replace(
            QUANTITY_OPERATIONS_TABLE,
            contents,
        )

    @property
    def properties(self) -> pd.DataFrame:
        """Properties per item type.

        Returns:
            DataFrame: One row per item type, with the properties declared for it.
        """
        return self._relation(f'SELECT * FROM "{QUANTITY_ITEM_PROPERTIES_TABLE}"').df()

    @properties.setter
    def properties(self, contents: Any) -> None:
        """Store ``contents`` as the item type properties, replacing what is there."""
        self._replace(QUANTITY_ITEM_PROPERTIES_TABLE, contents)

    @property
    def wide_qop(self):
        """Quantity operations in a wide (pivoted) format.

        Returns:
            DataFrame: One row per event and object, with ``ocel:eid``, ``ocel:oid``
            and one column per item type. Missing operations count as 0.
        """

        return self._relation(f"""
            PIVOT {QUANTITY_OPERATIONS_TABLE} ON {ident(QEL_ITEM_TYPE)} USING coalesce(first({ident(QEL_QUANTITY)}), 0)
        """).df()

    @property
    def wide_oqty(self):
        """Initial quantities in a wide (pivoted) format.

        Returns:
            DataFrame: One row per object, with ``ocel:oid`` and one column per
            item type. Missing quantities count as 0.
        """

        return self._relation(f"""
            PIVOT {QUANTITIES_TABLE} ON {ident(QEL_ITEM_TYPE)} USING coalesce(first({ident(QEL_QUANTITY)}), 0)
        """).df()

    def _distinct_values(self, field_name: str) -> DuckDBPyRelation:
        """``field_name``'s distinct values across both quantity tables, sorted."""
        field = ident(field_name)

        return self._relation(f""" 
            SELECT DISTINCT
                {field}
            FROM
                {QUANTITIES_TABLE}
            UNION
                SELECT DISTINCT
                    {field}
                FROM
                    {QUANTITY_OPERATIONS_TABLE}
            ORDER BY
                1
        """)

    @property
    def item_types(self) -> list[str]:
        """Every item type appearing in ``oqty`` or ``qop``.

        Returns:
            list[str]: Sorted list of unique item types.
        """

        return first_column_list(self._distinct_values(QEL_ITEM_TYPE))

    @property
    def objects(self) -> list[str]:
        """Every object id appearing in ``oqty`` or ``qop``.

        Returns:
            list[str]: Sorted list of unique object ids.
        """
        return first_column_list(self._distinct_values(OID_COL))

    @property
    def object_types(self) -> list[str]:
        """The types of the objects appearing in ``oqty`` or ``qop``.

        Returns:
            list[str]: Sorted list of unique object type names.
        """
        quantity_objects_table = "quantity_objects"
        return first_column_list(
            self._distinct_values(OID_COL).query(
                quantity_objects_table,
                f"""
                    SELECT DISTINCT
                        {ident(OTYPE_COL)}
                    FROM
                        {quantity_objects_table}
                    JOIN {OBJECTS_TABLE} USING ({ident(OID_COL)})
                    ORDER BY
                        1
                """,
            )
        )

    def _get_it_objects(self, item_type: str):
        """Objects with a non-zero ``item_type`` quantity, as a lazy relation."""
        oid, it_col, quantity_col = ident(OID_COL), ident(QEL_ITEM_TYPE), ident(QEL_QUANTITY)
        return self._relation(
            f"""
            SELECT DISTINCT {oid}
            FROM (
                SELECT {oid} FROM {QUANTITIES_TABLE}
                WHERE {it_col} = ? AND {quantity_col} != 0
                UNION ALL
                SELECT {oid} FROM {QUANTITY_OPERATIONS_TABLE}
                WHERE {it_col} = ? AND {quantity_col} != 0
            )
            ORDER BY 1
        """,
            [item_type, item_type],
        )

    def get_it_objects(self, item_type: str):
        """Object ids that carry or change ``item_type``, zero quantities aside.

        Args:
            item_type: The item type to filter on.

        Returns:
            list[str]: Sorted list of unique object ids.
        """

        return first_column_list(self._get_it_objects(item_type))

    def get_it_object_types(self, item_type: str) -> list[str]:
        """The types of the objects that carry or change ``item_type``.

        Args:
            item_type: The item type to filter on.

        Returns:
            list[str]: List of unique object type names.
        """

        item_objects_table = "item_objects_table"

        return first_column_list(
            self._get_it_objects(item_type).query(
                item_objects_table,
                f"""
                SELECT DISTINCT
                    {ident(OTYPE_COL)}
                FROM
                    {item_objects_table}
                JOIN {OBJECTS_TABLE} USING ({ident(OID_COL)})
            """,
            )
        )

    @property
    def events(self) -> list[str]:
        """Every event id appearing in ``qop`` -- initial quantities carry no event.

        Returns:
            list[str]: List of unique event ids.
        """
        return first_column_list(
            self._relation(f"""SELECT DISTINCT {ident(EID_COL)} FROM {QUANTITY_OPERATIONS_TABLE}""")
        )

    @property
    def activities(self) -> list[str]:
        """The activities of the events appearing in ``qop``.

        Returns:
            list[str]: List of unique activity names.
        """
        return first_column_list(
            self._relation(f"""
                SELECT DISTINCT
                    {ident(ACTIVITY_COL)}
                FROM
                    {QUANTITY_OPERATIONS_TABLE}
                JOIN {EVENTS_TABLE} USING ({ident(EID_COL)})
            """)
        )

    def get_it_events(self, item_type: str):
        """Event ids with a quantity operation on ``item_type``.

        Args:
            item_type: The item type to filter on.

        Returns:
            list[str]: List of unique event ids.
        """
        return first_column_list(
            self._relation(
                f"""
                SELECT DISTINCT
                    {ident(EID_COL)}
                FROM
                    {QUANTITY_OPERATIONS_TABLE}
                WHERE
                    {ident(QEL_ITEM_TYPE)} = ?
           """,
                [item_type],
            )
        )

    def get_it_activities(self, item_type: str):
        """The activities of the events with a quantity operation on ``item_type``.

        Args:
            item_type: The item type to filter on.

        Returns:
            list[str]: List of unique activity names.
        """
        return first_column_list(
            self._relation(
                f"""
                SELECT DISTINCT
                    {ident(ACTIVITY_COL)}
                FROM
                    {QUANTITY_OPERATIONS_TABLE}
                JOIN {EVENTS_TABLE} USING({ident(EID_COL)})
                WHERE
                    {ident(QEL_ITEM_TYPE)} = ?
           """,
                [item_type],
            )
        )

    def get_object_item_types(self, object_id: str):
        """Item types the object carries or changes, zero quantities aside.

        Args:
            object_id: The object to filter on.

        Returns:
            list[str]: List of unique item types.
        """

        it_col, oid_col, quantity_col = ident(QEL_ITEM_TYPE), ident(OID_COL), ident(QEL_QUANTITY)

        return first_column_list(
            self._relation(
                f"""
                SELECT DISTINCT {it_col} FROM (
                    SELECT {it_col} FROM {QUANTITY_OPERATIONS_TABLE}
                    WHERE {oid_col} = ? AND {quantity_col} != 0
                    UNION ALL
                    SELECT {it_col} FROM {QUANTITIES_TABLE}
                    WHERE {oid_col} = ? AND {quantity_col} != 0
                )   
            """,
                [object_id, object_id],
            )
        )

    def get_oqty_for_object(self, object_id: str) -> pd.Series:
        """The object's initial quantities.

        Args:
            object_id: The object to look up.

        Returns:
            Series: A pandas Series indexed by item type, containing the object's
            initial quantities as values.
        """

        item_type, quantity = ident(QEL_ITEM_TYPE), ident(QEL_QUANTITY)

        oqty = self._relation(
            f"""
            SELECT
                {item_type}, first({quantity}) AS {quantity}
            FROM
                {QUANTITIES_TABLE}
            WHERE
                {ident(OID_COL)} = ?
            GROUP BY ALL
            ORDER BY 1
        """,
            [object_id],
        ).to_df()

        return cast(pd.Series, oqty.set_index(QEL_ITEM_TYPE)[QEL_QUANTITY])

    def _item_level_development(
        self,
        object_id: str,
        item_types: list[str] | None = None,
        include_events: Literal["log", "trace", "active"] = "trace",
        include_oqty: bool = True,
        pre_event: bool = False,
    ) -> DuckDBPyRelation:
        """An object's item levels over time, as a lazy relation.

        See :meth:`get_item_level_development`, which is this and nothing more.
        """
        eid, oid = ident(EID_COL), ident(OID_COL)
        activity, timestamp = ident(ACTIVITY_COL), ident(TIMESTAMP_COL)
        item_type, quantity = ident(QEL_ITEM_TYPE), ident(QEL_QUANTITY)

        with_oqty = include_oqty

        return self._relation(f"""
            WITH trace AS (
                SELECT DISTINCT {eid}
                FROM {E2O_TABLE}
                WHERE {oid} = {literal(object_id)}
            ),
            event_table AS (
                SELECT {eid}, {activity}, {timestamp}
                FROM {EVENTS_TABLE}
                {f"JOIN trace USING ({eid})" if include_events != "log" else ""}
            ),
            object_operations AS (
                SELECT {eid}, {item_type}, {quantity}
                FROM {QUANTITY_OPERATIONS_TABLE}
                WHERE {oid} = {literal(object_id)} {
            f"AND {quantity} != 0" if include_events == "active" else ""
        }
            ),
            initial_quantities AS (
                SELECT
                    NULL AS {eid},
                    NULL AS {activity},
                    '-infinity'::TIMESTAMP AS {timestamp},
                    {item_type},
                    {quantity}
                FROM {QUANTITIES_TABLE}
                WHERE {oid} = {literal(object_id)} AND {quantity} != 0
            ),
            operations_per_event AS (
                SELECT
                    events.{eid},
                    events.{activity},
                    events.{timestamp},
                    operations.{item_type},
                    operations.{quantity}
                FROM object_operations operations
                {"JOIN" if include_events == "active" else "RIGHT JOIN"} event_table events USING ({
            eid
        })
                {"UNION ALL SELECT * FROM initial_quantities" if with_oqty else ""}
            )
            SELECT
                {eid},
                {activity},
                {timestamp},
                coalesce(
                    sum(COLUMNS(* EXCLUDE ({eid}, {activity}, {timestamp}))) OVER (
                        ORDER BY {timestamp}, {eid} 
                        {
            "ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING"
            if pre_event
            else "ROWS UNBOUNDED PRECEDING"
        }
                    ),
                    0
                )
            FROM (
                PIVOT operations_per_event
                ON {item_type} {
            f"IN ({', '.join(literal(it) for it in item_types)})" if item_types else ""
        }
                USING coalesce(first({quantity}), 0)
                GROUP BY {eid}, {activity}, {timestamp}
            )
            {f"QUALIFY {eid} IS NOT NULL" if with_oqty else ""}
            ORDER BY {timestamp}, {eid}
        """)

    def get_item_level_development(
        self,
        object_id: str,
        item_types: list[str] | None = None,
        include_events: Literal["log", "trace", "active"] = "trace",
        include_oqty: bool = True,
        pre_event: bool = False,
    ) -> pd.DataFrame:
        """How an object's item levels develop, one row per event.

        Rows are ordered by time and carry the event's id, activity and timestamp,
        plus one column per item type holding a running sum of its operations.

        Args:
            object_id: The object to follow.
            item_types: Item types to report on; all the object has, by default.
            include_events: Which events get a row -- ``"log"`` for every event,
                ``"trace"`` for those involving the object, ``"active"`` for those
                that actually change one of its quantities.
            include_oqty: Start from the object's initial quantities, so the values
                are absolute levels rather than net change.
            pre_event: Report the level each event *found*, not the one it leaves.

        Returns:
            DataFrame: One row per included event, ordered by timestamp, with
            ``ocel:eid``, ``ocel:activity``, ``ocel:timestamp`` and one column per
            reported item type.
        """
        return self._item_level_development(
            object_id,
            item_types=item_types,
            include_events=include_events,
            include_oqty=include_oqty,
            pre_event=pre_event,
        ).df()

    def get_object_item_level(
        self,
        object_id: str,
        timestamp: str | None = None,
        event_id: str | None = None,
        include_oqty: bool = True,
        include_cutoff: bool = False,
    ):
        """The object's item levels, over the events up to a cutoff.

        Args:
            object_id: The object to follow.
            timestamp: Cut off at this timestamp.
            event_id: Cut off at this event's timestamp; ignored if ``timestamp``
                is given. Without either, the whole log is included.
            include_oqty: Start from the object's initial quantities.
            include_cutoff: Keep the events at the cutoff itself, rather than
                stopping short of them.

        Returns:
            DataFrame: The development rows up to the cutoff, one per event that
            changes a quantity, shaped like
            :meth:`get_item_level_development`'s.
        """

        item_lvl_dev = self._item_level_development(
            object_id, include_events="active", include_oqty=include_oqty
        )
        cutoff_expr = None
        if timestamp is not None:
            cutoff_expr = f"CAST({literal(timestamp)} AS TIMESTAMP)"
        elif event_id is not None:
            cutoff_expr = (
                f"(SELECT {ident(TIMESTAMP_COL)} FROM {EVENTS_TABLE} "
                f"WHERE {ident(EID_COL)} = {literal(event_id)})"
            )

        where = (
            f"WHERE {ident(TIMESTAMP_COL)} {'<=' if include_cutoff else '<'} {cutoff_expr}"
            if cutoff_expr
            else ""
        )

        return item_lvl_dev.query(
            "item_lvl_dev",
            f"""
                SELECT * 
                FROM item_lvl_dev
                {where}
            """,
        ).df()

    @property
    def it_object_type_count(self):
        """Per item type and object type, how many distinct objects are involved.

        Returns:
            DataFrame: One row per item type and object type, with a ``count`` of
            the distinct objects holding a non-zero quantity of it.
        """

        otype, oid, eid = ident(OTYPE_COL), ident(OID_COL), ident(EID_COL)
        itype, iqty = ident(QEL_ITEM_TYPE), ident(QEL_QUANTITY)

        return self._relation(f"""
            SELECT
                {itype},
                {otype},
                count(DISTINCT {oid}) as count
            FROM
                (
                    SELECT
                        *
                    FROM
                        {QUANTITIES_TABLE}
                    UNION
                    (
                        SELECT
                            * EXCLUDE {eid}
                        FROM
                            {QUANTITY_OPERATIONS_TABLE}
                    )
                )
            JOIN {OBJECTS_TABLE} USING ({oid})
            WHERE {iqty} != 0
            GROUP BY ALL
        """).to_df()

    @property
    def it_activity_count(self):
        """Per item type and activity, how many distinct events are involved.

        Returns:
            DataFrame: One row per item type and activity, with the number of
            distinct events carrying a non-zero operation on it.
        """
        eid, act = ident(EID_COL), ident(ACTIVITY_COL)
        itype, iqty = ident(QEL_ITEM_TYPE), ident(QEL_QUANTITY)

        return self._relation(f"""
            SELECT
                {itype},
                {act},
                count(DISTINCT {eid})
            FROM
                {QUANTITY_OPERATIONS_TABLE}
            JOIN events USING({eid})
            WHERE
                {iqty} != 0
            GROUP BY ALL
        """).to_df()

    def get_ilvl_table(
        self, include_oqty: bool = True, pre_event: bool = False
    ) -> DuckDBPyRelation:
        """How every object's item levels develop, one row per event it takes part in.

        The quantity operations are summed per object and item type in event order,
        and the result is pivoted, so each item type becomes a column holding the
        running level.

        Args:
            include_oqty: Seed each object and item type with the object's initial
                quantity -- zero for the ones only quantity operations mention --
                so the levels are absolute rather than net change.
            pre_event: Report the level each event *found*, not the one it leaves.

        Returns:
            DuckDBPyRelation: One row per event and object, ordered by timestamp
            and event id, with ``ocel:oid``, ``ocel:eid``, ``ocel:activity``,
            ``ocel:timestamp`` and one column per item type.
        """

        oid, eid = ident(OID_COL), ident(EID_COL)
        act, ts = ident(ACTIVITY_COL), ident(TIMESTAMP_COL)
        itype, iqty = ident(QEL_ITEM_TYPE), ident(QEL_QUANTITY)

        window = (
            "ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING"
            if pre_event
            else "ROWS UNBOUNDED PRECEDING"
        )

        seed_union = "UNION BY NAME FROM initial_values" if include_oqty else ""
        drop_seeds = f"QUALIFY {eid} IS NOT NULL" if include_oqty else ""

        return self._relation(
            f"""
                WITH
                initial_values as (
                    SELECT
                    {oid},
                    {itype},
                    coalesce(oqty.{iqty}, 0) as {iqty},
                    '-infinity'::TIMESTAMP AS {ts},
                    FROM
                    {QUANTITIES_TABLE} oqty
                    FULL OUTER JOIN (
                        SELECT DISTINCT
                        {oid},
                        {itype}
                        FROM
                        {QUANTITY_OPERATIONS_TABLE}
                    ) empty_oqty USING ({oid}, {itype})
                ),
                joined_qop as (
                    SELECT
                    oqty.*,
                    ev.{act},
                    ev.{ts}
                    FROM
                    {QUANTITY_OPERATIONS_TABLE} oqty
                    JOIN {EVENTS_TABLE} ev USING ({eid})
                ),
                unpivoted_itlvl as (
                    SELECT
                    COLUMNS (* EXCLUDE {iqty}),
                    sum({iqty}) OVER (
                        PARTITION BY
                        {oid},
                        {itype}
                        ORDER BY
                        {ts},
                        {eid}
                        {window}
                    ) as item_level
                    FROM
                    (
                        SELECT
                        *
                        FROM
                        joined_qop
                        {seed_union}
                    )
                    {drop_seeds}
                )
                PIVOT unpivoted_itlvl ON {itype} USING (coalesce(first("item_level"), 0))
                ORDER BY
                {ts},
                {eid}
            """
        )

    def get_ilvl(self, include_oqty: bool = True, pre_event: bool = False):
        """The item level development of the whole log, as a DataFrame.

        Args:
            include_oqty: Start from the objects' initial quantities, so the values
                are absolute levels rather than net change.
            pre_event: Report the level each event *found*, not the one it leaves.

        Returns:
            DataFrame: :meth:`get_ilvl_table`'s rows.
        """
        return self.get_ilvl_table(include_oqty=include_oqty, pre_event=pre_event).to_df()
