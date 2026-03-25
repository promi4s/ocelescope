import numpy as np
import pandas as pd

from ocelescope.ocel.constants import ACTIVITY_COL
from ocelescope.ocel.constants.attributes import ATTRIBUTE_COL
from ocelescope.ocel.constants.pm4py import EID_COL, OID_COL, OTYPE_COL, TIMESTAMP_COL
from ocelescope.ocel.managers.base import BaseManager
from ocelescope.util.pandas import infer_value_type, num_max, num_min, str_max, str_min


class AttributeManager(BaseManager):
    def get_summary(
        self,
        include_objects: bool = True,
        include_events: bool = True,
        group_by_entity_type: bool = False,
    ):
        """summarize ocel event/object attributes.

        aggregates per-attribute statistics over the selected event and/or object
        tables (including object changes). computes distinct value counts, non-null
        counts, an inferred value type, and min/max values. min/max are numeric for
        numeric attributes and lexicographic otherwise.

        ARGS:
            include_objects: whether to include object attributes (base objects plus
                object changes) in the summary.
            include_events: whether to include event attributes in the summary.
            group_by_entity_type: if true, compute statistics per attribute and per
                (type, entity kind). if false, compute statistics per attribute only.

        RETURNS:
            a pandas dataframe indexed by attribute name (and optionally by type and
            entity kind) with columns: `distinct_values`, `total`, `type`, `min`,
            and `max`.
        """

        event_table = self._ocel.events.df if include_events else pd.DataFrame()
        object_table = (
            pd.concat(
                [self._ocel.objects.df, self._ocel.objects.changes], ignore_index=True, sort=False
            )
            if include_objects
            else pd.DataFrame()
        )

        event_table = event_table.rename(columns={ACTIVITY_COL: OTYPE_COL}).drop(
            columns=[EID_COL, TIMESTAMP_COL], errors="ignore"
        )
        object_table = object_table.drop(
            columns=["ocel:field", OID_COL, TIMESTAMP_COL], errors="ignore"
        )

        entity_type_field = "ocel:entity_type"
        if not event_table.empty:
            event_table[entity_type_field] = "events"
        if not object_table.empty:
            object_table[entity_type_field] = "objects"

        base = pd.concat([event_table, object_table], ignore_index=True, sort=False)

        group_cols = (
            [ATTRIBUTE_COL]
            if not group_by_entity_type
            else [ATTRIBUTE_COL, OTYPE_COL, entity_type_field]
        )

        attribute_table = (
            base.replace("null", pd.NA)
            .melt(
                id_vars=[OTYPE_COL, entity_type_field], var_name=ATTRIBUTE_COL, value_name="value"
            )
            .dropna(subset=["value"])
            .groupby(group_cols, sort=False)
            .agg(
                distinct_values=("value", "nunique"),
                min_str=("value", str_min),
                max_str=("value", str_max),
                min_num=("value", num_min),
                max_num=("value", num_max),
                total=("value", "size"),
                type=("value", infer_value_type),
            )
        )

        num_mask = attribute_table["type"].isin(["int", "float", "numeric"])

        attribute_table["min"] = np.where(
            num_mask,
            attribute_table["min_num"],
            attribute_table["min_str"],
        )

        attribute_table["max"] = np.where(
            num_mask,
            attribute_table["max_num"],
            attribute_table["max_str"],
        )

        return attribute_table.drop(columns=["min_str", "max_str", "min_num", "max_num"])

    @property
    def object_summary(self):
        """Return an attribute summary for objects, grouped by object type.

        RETURNS:
            A pandas DataFrame indexed by (ATTRIBUTE_COL, OTYPE_COL) containing the
            summary statistics produced by `get_summary`.
        """

        return self.get_summary(group_by_entity_type=True, include_events=False).droplevel(
            "ocel:entity_type"
        )

    @property
    def event_summary(self):
        """Return an attribute summary for events, grouped by activity.

        RETURNS:
            A pandas DataFrame indexed by (ATTRIBUTE_COL, ACTIVITY_COL) containing
            the summary statistics produced by `get_summary`.
        """

        return (
            self.get_summary(group_by_entity_type=True, include_objects=False)
            .droplevel("ocel:entity_type")
            .rename_axis(index={OTYPE_COL: ACTIVITY_COL})
        )
