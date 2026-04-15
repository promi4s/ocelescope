from pathlib import Path
from typing import TYPE_CHECKING, Literal, cast

import pandas as pd

from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, EID_COL, OID_COL, OTYPE_COL, TIMESTAMP_COL
from ocelescope.ocel.constants.quantity import (
    OQTY_COLUMNS,
    QEL_ITEM_TYPE,
    QEL_QUANTITY,
    QOP_COLUMNS,
)
from ocelescope.ocel.managers.base import BaseManager
from ocelescope.ocel.managers.quantities.util.io import (
    read_quantity_extension,
    write_quantity_extension,
)

if TYPE_CHECKING:
    from ocelescope.ocel.core.ocel import OCEL


class QuantityManager(BaseManager):
    """Manage the **quantity extension** of an OCEL instance.

    This manager encapsulates:
      - Reading/writing quantity-extension tables (initial quantities and quantity operations)
      - Convenience views (wide/pivoted forms)
      - Helpers to query involved item types, objects, and events
      - Aggregations of quantity operations over time for a given object

    Attributes:
        oqty: DataFrame containing *initial quantities* per object and item type.
        qop: DataFrame containing *quantity operations* per event, object, and item type.
    """

    def __init__(
        self,
        ocel: "OCEL",
    ):
        super().__init__(ocel)

        self.oqty, self.qop = (
            read_quantity_extension(ocel.meta.path)
            if ocel.meta.path is not None
            else (pd.DataFrame(columns=OQTY_COLUMNS), pd.DataFrame(columns=QOP_COLUMNS))
        )

        self.qop = self.qop.loc[self._cleaned_qop_mask].reset_index(drop=True)
        self.oqty = self.oqty.loc[self._cleaned_oqty_mask].reset_index(drop=True)

    def write_quantities(self, path: Path):
        """Write quantity-extension tables to a OCEL file.

        Writes the initial quantities (`oqty`) and quantity operations (`qop`) to
        the given directory path if at least one of them is non-empty.

        Args:
            path: Target directory where the quantity extension should be stored.
        """

        if not self.oqty.empty or not self.qop.empty:
            write_quantity_extension(
                path,
                self.oqty.loc[self._cleaned_oqty_mask],
                self.qop.loc[self._cleaned_qop_mask],
            )

    @property
    def _cleaned_oqty_mask(self):
        return self.oqty[QEL_QUANTITY].ne(0)

    @property
    def _cleaned_qop_mask(self):
        return self.qop[QEL_QUANTITY].ne(0)

    @property
    def wide_qop(self):
        """Return quantity operations in a wide (pivoted) format.

        The returned DataFrame has one row per (event id, object id), and one column
        per item type containing the corresponding quantity operation value.

        Returns:
            A wide/pivoted DataFrame of `qop` with columns:
            - `EID_COL`, `OID_COL`
            - one column per item type (from `QEL_ITEM_TYPE`)
        """

        return (
            self.qop.pivot_table(
                index=[EID_COL, OID_COL],
                columns=QEL_ITEM_TYPE,
                values=QEL_QUANTITY,
                fill_value=0,
                aggfunc="first",
            )
            .reset_index()
            .rename_axis(index=None, columns=None)
        )

    @property
    def wide_oqty(self):
        """Return initial quantities in a wide (pivoted) format.

        The returned DataFrame has one row per object id and one column per item type.

        Returns:
            A wide/pivoted DataFrame of `oqty` indexed by `OID_COL`.
        """

        return self.oqty.pivot_table(
            index=[OID_COL],
            columns=QEL_ITEM_TYPE,
            values=QEL_QUANTITY,
            aggfunc="first",
            fill_value=0,
        )

    @property
    def item_types(self) -> list[str]:
        """Return all item types present in initial quantities or quantity operations.

        Returns:
            A list of unique item type identifiers (strings).
        """

        return (
            pd.concat(
                [
                    self.oqty.loc[self._cleaned_oqty_mask, QEL_ITEM_TYPE],
                    self.qop.loc[self._cleaned_qop_mask, QEL_ITEM_TYPE],
                ],
                ignore_index=True,
            )
            .dropna()
            .unique()
            .tolist()
        )

    @property
    def objects(self):
        """Return all object ids involved in quantities.

        Includes:
          - objects appearing in any quantity operation, and
          - objects with any initial quantity row.

        Returns:
            An array-like of unique object ids.
        """
        return (
            pd.concat(
                [
                    self.oqty.loc[self._cleaned_oqty_mask, OID_COL],
                    self.qop.loc[self._cleaned_qop_mask, OID_COL],
                ],
                ignore_index=True,
            )
            .dropna()
            .unique()
        )

    @property
    def object_types(self) -> list[str]:
        """Return all object types involved in quantities.


        Returns:
            A list of object types
        """
        oid_type_map = self._ocel.objects.type_by_id

        return oid_type_map.loc[oid_type_map.index.isin(self.objects)].drop_duplicates().to_list()

    def get_it_objects(self, item_type: str):
        """Return object ids involved for a given item type.

        Includes object ids that:
          - appear in a quantity operation for the given item type, or
          - have an initial quantity row for the given item type.

        Args:
            item_type: Item type to filter on.

        Returns:
            An array-like of unique object ids.
        """

        oqty_ids = self.oqty.loc[
            self.oqty[QEL_ITEM_TYPE].eq(item_type) & self._cleaned_oqty_mask, OID_COL
        ]
        qop_ids = self.qop.loc[
            self.qop[QEL_ITEM_TYPE].eq(item_type) & self._cleaned_qop_mask, OID_COL
        ]

        return pd.concat([oqty_ids, qop_ids], ignore_index=True).dropna().unique()

    def get_it_object_types(self, item_type: str) -> list[str]:
        """Return object types involved for a given item type.

        Object types are determined by looking up the involved object ids in the
        OCEL objects table.

        Args:
            item_type: Item type to filter on.

        Returns:
            A list of unique object type identifiers.
        """
        return (
            self._ocel.objects.df.loc[
                self._ocel.objects.df[OID_COL].isin(self.get_it_objects(item_type)), OTYPE_COL
            ]
            .dropna()
            .unique()
        ).tolist()

    @property
    def events(self):
        """Return all event ids involved in quantity operations.

        Returns:
            An array-like of unique event ids.
        """
        return self.qop[EID_COL].dropna().unique()

    @property
    def activities(self) -> list[str]:
        """Return all activities involved in quantities.


        Returns:
            A list of activities
        """
        activity_id_map = self._ocel.events.activity_by_id

        return (
            activity_id_map.loc[activity_id_map.index.isin(self.events)].drop_duplicates().tolist()
        )

    def get_it_events(self, item_type: str):
        """Return event ids involved in quantity operations for a given item type.

        Args:
            item_type: Item type to filter on.

        Returns:
            An array-like of unique event ids.

        """
        return (
            self.qop.loc[self.qop[QEL_ITEM_TYPE].eq(item_type) & self._cleaned_qop_mask, EID_COL]
            .dropna()
            .unique()
        )

    def get_object_item_types(self, object_id: str):
        """Return item types associated with a given object.

        Includes item types that:
          - appear in initial quantities for the object, or
          - appear in any quantity operation for the object.

        Args:
            object_id: Object id to filter on.

        Returns:
            An array-like of unique item type identifiers.
        """

        initial_item_types = self.oqty.loc[
            self.oqty[OID_COL].eq(object_id) & self._cleaned_oqty_mask, QEL_ITEM_TYPE
        ]

        active_qty_operations = self.qop.loc[
            self.qop[OID_COL].eq(object_id) & self._cleaned_qop_mask, QEL_ITEM_TYPE
        ]

        return pd.concat([initial_item_types, active_qty_operations]).dropna().unique()

    def get_oqty_for_object(self, object_id: str) -> pd.Series:
        """Return the initial quantities (oqty) for a specific object as a Series.

        The returned Series is indexed by item type (`QEL_ITEM_TYPE`) and contains the
        corresponding initial quantity values (`QEL_QUANTITY`) for the given object.

        Args:
            object_id: Object id to filter on.

        Returns:
            A pandas Series with index `QEL_ITEM_TYPE` and values `QEL_QUANTITY`
            representing the initial quantities for the given object. If the underlying
            data contains multiple rows for the same item type, the Series will have a
            non-unique index (i.e., duplicate item-type entries).
        """

        return self.oqty.loc[
            self.oqty[OID_COL].eq(object_id) & self._cleaned_oqty_mask,
            [QEL_ITEM_TYPE, QEL_QUANTITY],
        ].set_index(QEL_ITEM_TYPE)[QEL_QUANTITY]

    # TODO: Check if using get_item_level_development would be more efficient
    def get_object_item_level(
        self,
        object_id: str,
        timestamp: str | None = None,
        event_id: str | None = None,
        include_oqty: bool = True,
        include_cutoff: bool = False,
    ):
        """Return item-level quantity for an object up to a cutoff.

        Sums the object's quantity operations (qop) up to a cutoff timestamp and,
        optionally, adds the object's initial quantities (oqty).

        The cutoff is taken from `timestamp` and/or `event_id` (if both are provided,
        the earlier timestamp is used). If `include_cutoff` is True the cutoff is
        inclusive (<=); otherwise it is exclusive (<).

        Args:
            object_id: Object id to aggregate for.
            timestamp: Optional cutoff timestamp (parsed via `pd.Timestamp`).
            event_id: Optional event id whose timestamp can be used as a cutoff.
            include_oqty: If True, add initial quantities (oqty) to the result.
            include_cutoff: If True include rows at the cutoff timestamp (<=),
                otherwise exclude them (<).

        Returns:
            A pandas Series with one entry per item type.
        """

        wide_qop = self.wide_qop

        wide_qop_with_timestamps = (
            wide_qop.loc[wide_qop[OID_COL].eq(object_id)]
            .merge(self._ocel.events.df[[EID_COL, TIMESTAMP_COL]], on=EID_COL)
            .sort_values(by=TIMESTAMP_COL)
            .set_index(EID_COL)
        )

        cutt_of = pd.Timestamp(timestamp) if timestamp is not None else None

        if event_id:
            event_timestamp: pd.Timestamp = cast(
                pd.Timestamp,
                self._ocel.events.df.loc[
                    self._ocel.events.df[EID_COL].eq(event_id), TIMESTAMP_COL
                ].iat[0],
            )

            cutt_of = event_timestamp if cutt_of is None else min(event_timestamp, cutt_of)

        if cutt_of:
            wide_qop_with_timestamps = wide_qop_with_timestamps.loc[
                wide_qop_with_timestamps[TIMESTAMP_COL].le(cutt_of)
                if include_cutoff
                else wide_qop_with_timestamps[TIMESTAMP_COL].lt(cutt_of)
            ]

        object_item_level = (
            wide_qop_with_timestamps.drop(columns=[TIMESTAMP_COL, OID_COL], errors="ignore")
            .agg(["sum"])
            .iloc[0]
        )

        if include_oqty:
            object_item_types = self.get_object_item_types(object_id)
            initial_quantities = self.get_oqty_for_object(object_id=object_id).reindex(
                object_item_types, fill_value=0
            )

            object_item_level[object_item_types] = object_item_level[object_item_types].add(
                initial_quantities
            )

        return (
            object_item_level.add(self.wide_oqty.loc[object_id].iloc[0], fill_value=0)
            if include_oqty
            else object_item_level
        )

    def get_item_level_development(
        self,
        object_id: str,
        item_types: list[str] | None = None,
        include_events: Literal["log", "trace", "active"] = "trace",
        include_oqty: bool = True,
        pre_event: bool = False,
    ) -> pd.DataFrame:
        """Get item-level development for an object as a per-event DataFrame.

        The returned DataFrame is ordered by time and contains event metadata along
        with one column per selected item type. Values represent the cumulative
        development over the included events (cumulative sum of per-event quantity
        changes). Optionally, the cumulative development can be offset by the
        object's initial quantities (oqty) so that values represent absolute
        quantities over time.

        Args:
            object_id: The object id to compute development for.
            item_types: Optional list of item type names to include. If None, all
                item types available for the given object are included.
            include_events: Which events to include in the output:
                "log" (all events), "trace" (events involving the object), or
                "active" (only events where at least one selected item type changes).
            include_oqty: If True, add the object's initial quantities (oqty) to the
                cumulative development for each selected item type (i.e., return
                absolute quantities rather than net change).

        Returns:
            A pandas DataFrame ordered by timestamp with columns
            `[EID_COL, ACTIVITY_COL, TIMESTAMP_COL]` plus one column per selected item
            type. If `include_oqty=True`, item-type columns contain absolute
            quantities (initial oqty + cumulative changes); otherwise they contain
            cumulative changes only.
        """

        item_level_development = self.wide_qop

        object_item_types = [
            item_type
            for item_type in self.get_object_item_types(object_id)
            if item_type in item_level_development.columns
            and (item_types is None or item_type in item_types)
        ]

        item_level_development = item_level_development.loc[
            item_level_development[OID_COL].eq(object_id), [EID_COL, *object_item_types]
        ]

        events_df = self._ocel.events.df[[EID_COL, ACTIVITY_COL, TIMESTAMP_COL]]

        if include_events != "log":
            events_df = events_df.loc[
                events_df[EID_COL].isin(self._ocel.e2o.get_events_of_object(object_id))
            ]

        item_level_development = pd.merge(
            item_level_development,
            events_df,
            on=EID_COL,
            how="left" if include_events == "active" else "right",
        )

        item_level_development[object_item_types] = item_level_development[
            object_item_types
        ].fillna(0)

        if include_events == "active":
            item_level_development = item_level_development.loc[
                ~item_level_development[object_item_types].eq(0).all(axis=1)
            ]

        item_level_development = item_level_development.sort_values(TIMESTAMP_COL, ascending=True)

        if pre_event:
            item_level_development = item_level_development.shift(1, fill_value=0)

        item_level_development[object_item_types] = item_level_development[
            object_item_types
        ].cumsum()

        if include_oqty:
            initial_quantities = self.get_oqty_for_object(object_id=object_id).reindex(
                object_item_types, fill_value=0
            )

            item_level_development[object_item_types] = item_level_development[
                object_item_types
            ].add(initial_quantities)

        return item_level_development.reset_index(drop=True)

    def _get_it_entity_type_count(self, entity_type: Literal["events", "objects"]):
        id_col = OID_COL if entity_type == "objects" else EID_COL
        type_col = OTYPE_COL if entity_type == "objects" else ACTIVITY_COL

        id_to_type_map = (
            self._ocel.objects.type_by_id
            if entity_type == "objects"
            else self._ocel.events.activity_by_id
        )

        it_entity_id_pairs = pd.concat(
            [
                self.qop.loc[self._cleaned_qop_mask, [id_col, QEL_ITEM_TYPE]],
                *(
                    [self.oqty.loc[self._cleaned_qop_mask, [id_col, QEL_ITEM_TYPE]]]
                    if entity_type == "objects"
                    else []
                ),
            ],
            ignore_index=True,
        ).drop_duplicates()

        it_entity_id_pairs = pd.merge(it_entity_id_pairs, id_to_type_map, on=id_col)

        return it_entity_id_pairs.groupby([QEL_ITEM_TYPE, type_col]).agg(count=(id_col, "nunique"))[
            "count"
        ]

    @property
    def it_object_type_count(self) -> pd.Series:
        """Count involved object types per item type.

        The returned Series is indexed by (item type, object type) and contains the
        number of **distinct objects** that occur for each such pair. Object types are
        derived by mapping object ids to their type via the OCEL objects table.

        Returns:
            pd.Series: A Series with a MultiIndex
            ``(QEL_ITEM_TYPE, OTYPE_COL)``. Values are the number of unique objects
            (``OID_COL``) for each (item type, object type) pair.
        """
        return self._get_it_entity_type_count("objects")

    @property
    def it_activity_count(self) -> pd.Series:
        """Count involved activities per item type.

        The returned Series is indexed by (item type, activity) and contains the
        number of **distinct events** that occur for each such pair. Activities are
        derived by mapping event ids to their activity via the OCEL events table.

        Returns:
            pd.Series: A Series with a MultiIndex
            ``(QEL_ITEM_TYPE, ACTIVITY_COL)``. Values are the number of unique events
            (``EID_COL``) for each (item type, activity) pair.
        """
        return self._get_it_entity_type_count("events")
