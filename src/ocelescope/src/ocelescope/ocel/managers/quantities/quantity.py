from pathlib import Path
from typing import TYPE_CHECKING

import pandas as pd

from ocelescope.ocel.constants.pm4py import EID_COL, OID_COL, OTYPE_COL, TIMESTAMP_COL
from ocelescope.ocel.managers.base import BaseManager
from ocelescope.ocel.managers.quantities.util.constants import (
    OQTY_COLUMNS,
    QEL_ITEM_TYPE,
    QEL_QUANTITY,
    QOP_COLUMNS,
)
from ocelescope.ocel.managers.quantities.util.io import (
    read_quantity_extension,
    write_quantity_extension,
)

if TYPE_CHECKING:
    from ocelescope.ocel.core.ocel import OCEL


class QuantityManager(BaseManager):
    """
    Manages event-to-object (E2O) relations within an OCEL instance.

    Provides:
        - Access to the raw E2O relation table
        - A normalized E2O table using canonical column names
        - Enriched E2O table including activity and object type information
        - Aggregated multiplicity summaries for E2O relations

    This manager acts as a typed and normalized façade over the
    PM4PY E2O relations.
    """

    def __init__(
        self,
        ocel: "OCEL",
    ):
        super().__init__()
        self._ocel = ocel

        self.oqty, self.qop = (
            read_quantity_extension(ocel.meta.path)
            if ocel.meta.path is not None
            else (pd.DataFrame(columns=OQTY_COLUMNS), pd.DataFrame(columns=QOP_COLUMNS))
        )

    def write_quantities(self, path: Path):
        if not self.oqty.empty or not self.qop.empty:
            write_quantity_extension(path, self.oqty, self.qop)

    @property
    def wide_qop(self):
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
        return self.oqty.pivot_table(
            index=[OID_COL],
            columns=QEL_ITEM_TYPE,
            values=QEL_QUANTITY,
            aggfunc="first",
            fill_value=0,
        )

    @property
    def item_types(self) -> list[str]:
        return (
            pd.concat([self.oqty[QEL_ITEM_TYPE], self.qop[QEL_ITEM_TYPE]], ignore_index=True)
            .dropna()
            .unique()
            .tolist()
        )

    @property
    def objects(self):
        """
        Returns list with all object ids involved in a quantity operation or with an initial quantity !=0 for any item type.
        """
        return (
            pd.concat([self.oqty[OID_COL], self.qop[OID_COL]], ignore_index=True).dropna().unique()
        )

    def get_it_objects(self, item_type: str):
        """
        Returns object ids involved in a quantity operation or with an initial quantity != 0
        for the given item type.
        """
        oqty_ids = self.oqty.loc[self.oqty[QEL_ITEM_TYPE].eq(item_type), OID_COL]
        qop_ids = self.qop.loc[self.qop[QEL_ITEM_TYPE].eq(item_type), OID_COL]

        return pd.concat([oqty_ids, qop_ids], ignore_index=True).dropna().unique()

    def get_it_object_types(self, item_type: str):
        """
        Returns list with all object types involved in a quantity operation or with an initial quantity !=0 for passed item type
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
        """
        Returns list with all event ids involved in a quantity operation.
        """
        return self.qop[EID_COL].dropna().unique()

    def get_it_events(self, item_type: str):
        """
        Returns list with all event ids involved in a quantity operation for a specific item type.
        """
        self.qop.loc[self.qop[QEL_ITEM_TYPE].eq(item_type), EID_COL]

    def get_object_item_types(self, object_id: str):
        initial_item_types = self.oqty.loc[self.oqty[OID_COL] == object_id, QEL_ITEM_TYPE]
        active_qty_operations = self.qop.loc[self.qop[OID_COL] == object_id, QEL_ITEM_TYPE]

        return pd.concat([initial_item_types, active_qty_operations]).dropna().unique()

    def get_oqty_for_object(self, object_id) -> pd.DataFrame:
        """
        Returns a DataFrame object containing the quantities for each item type for a specific object ID.
        """
        return self.oqty.loc[self.oqty[OID_COL].eq(object_id)]

    def get_aggr_object_item_levels(
        self, object_id: str, timestamp: str | None = None, event_id: str | None = None
    ):
        wide_qop_with_timestamps = (
            self.wide_qop.loc[self.wide_qop[OID_COL].eq(object_id)]
            .merge(self._ocel.events.df[[EID_COL, TIMESTAMP_COL]], on=EID_COL)
            .sort_values(by=TIMESTAMP_COL)
            .set_index(EID_COL)
        )

        if event_id:
            event_timestamp = str(wide_qop_with_timestamps.loc[event_id, TIMESTAMP_COL])

            if event_timestamp and timestamp:
                timestamp = min(event_timestamp, timestamp)
            else:
                timestamp = event_timestamp

        if timestamp:
            wide_qop_with_timestamps = wide_qop_with_timestamps.loc[
                wide_qop_with_timestamps[TIMESTAMP_COL].le(timestamp)
            ]

        return (
            wide_qop_with_timestamps.drop(columns=[TIMESTAMP_COL, OID_COL], errors="ignore")
            .agg(["sum"])
            .iloc[0]
            # I know this looks ugly but pyright won't shut up
        ).add(self.wide_oqty.loc["Planning System"].iloc[0], fill_value=0)
