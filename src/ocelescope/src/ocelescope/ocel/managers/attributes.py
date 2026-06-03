import pandas as pd

from ocelescope.ocel.constants import ACTIVITY_COL
from ocelescope.ocel.constants.attributes import ATTRIBUTE_COL
from ocelescope.ocel.constants.pm4py import (
    EID_COL,
    OBJECT_CHANGES_DF_COLS,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.ocel.managers.base import BaseManager
from ocelescope.ocel.util.attributes import summarize_attribute_values

ENTITY_TYPE = "ocel:entity_type"
ENTITY_TYPE_NAME = "ocel:entity_type_name"


class AttributeManager(BaseManager):
    def _merged_att_table(
        self,
        object_types: list[str] | None = None,
        activities: list[str] | None = None,
        attributes: list[str] | None = None,
    ):
        """Build a merged event/object attribute table for downstream summaries.

        This helper:
        - selects a subset of the event table (optionally filtered by `activities`)
        - selects a subset of the object base table and object change table
        (optionally filtered by `object_types`)
        - concatenates events + objects(+changes) into one dataframe
        - removes known technical columns (when present) and normalizes "null"/""
        to missing values
        - optionally restricts output to identifier columns plus the requested
        attribute columns.

        Parameters
        ----------
        object_types:
            Object types to include. If None, include all object types found in
            `self._ocel.objects.df` and `self._ocel.objects.changes`. If provided,
            both base objects and object changes are filtered to these types.
        activities:
            Event activities to include. If None, include all events. If provided,
            the event table is filtered to these activities.
        attributes:
            Attribute column names to include. If None, keep all columns. If
            provided, the output is reduced to the id columns
            (`OID_COL`, `EID_COL`, `OTYPE_COL`, `ACTIVITY_COL`, `TIMESTAMP_COL`)
            plus the requested attribute columns that exist in the merged table.

        Returns
        -------
        pandas.DataFrame
            A dataframe containing a union of event rows and object/object-change
            rows with normalized missing values.
        """

        objects_table = (
            self._ocel.objects.df
            if object_types is None
            else self._ocel.objects.df.loc[self._ocel.objects.df[OTYPE_COL].isin(object_types)]
        )

        changes_table = (
            self._ocel.objects.changes
            if object_types is None
            else self._ocel.objects.changes.loc[
                self._ocel.objects.changes[OTYPE_COL].isin(object_types)
            ]
        )

        events_table = (
            self._ocel.events.df
            if activities is None
            else self._ocel.events.df.loc[self._ocel.events.df[ACTIVITY_COL].isin(activities)]
        )

        object_keep = [col for col in objects_table.columns if col != OID_COL]
        changes_keep = [
            col
            for col in changes_table.columns
            if col not in [c for c in OBJECT_CHANGES_DF_COLS if c != OTYPE_COL]
        ]
        event_keep = [col for col in events_table.columns if col not in [EID_COL, TIMESTAMP_COL]]

        if attributes is not None:
            allowed = set(attributes) | {ACTIVITY_COL, OTYPE_COL}
            object_keep = [col for col in object_keep if col in allowed]
            changes_keep = [col for col in changes_keep if col in allowed]
            event_keep = [col for col in event_keep if col in allowed]

        return pd.concat(
            [
                table
                for table in [
                    objects_table[object_keep],
                    changes_table[changes_keep],
                    events_table[event_keep],
                ]
                if len(table) > 0
            ],
            ignore_index=True,
        )

    def get_aggr_summary(
        self,
        object_types: list[str] | None = None,
        activities: list[str] | None = None,
        attributes: list[str] | None = None,
    ):
        """Compute an aggregated attribute summary across events and objects.

        The summary is computed *per attribute name* across the selected rows from:
        - the event table (optionally filtered by `activities`)
        - the object base table + object change table (optionally filtered by
        `object_types`)

        For each attribute, the method computes:
        - number of distinct non-null values
        - total number of non-null values
        - inferred value type (`infer_column_dtype`)
        - min/max values
            * numeric min/max when the inferred type is numeric
            * lexicographic min/max otherwise
        - which activities and object types the attribute appeared in

        Parameters
        ----------
        object_types:
            Object types to include (applies to both base objects and object
            changes). None means "all".
        activities:
            Event activities to include. None means "all".
        attributes:
            Optional list of attribute columns to summarize. None means "all
            available attributes".

        Returns
        -------
        pandas.DataFrame
            A dataframe indexed by `ATTRIBUTE_COL` with (at least) the columns:
            `distinct_values`, `type`, `min`, `max`, `activities`,
            `object_types`.
        """
        attr_table = self._merged_att_table(
            object_types=object_types, activities=activities, attributes=attributes
        )

        return pd.DataFrame(
            [
                summarize_attribute_values(attr_name, attr_table)
                for attr_name in attr_table.columns
                if attr_name not in [ACTIVITY_COL, OTYPE_COL]
            ],
            columns=[
                ATTRIBUTE_COL,
                "type",
                "min",
                "max",
                "distinct_values",
                "activities",
                "object_types",
            ],
        ).set_index(ATTRIBUTE_COL, drop=True)

    def get_summary(
        self,
        object_types: list[str] | None = None,
        activities: list[str] | None = None,
        attributes: list[str] | None = None,
    ):
        """Compute an attribute summary split by entity kind and entity name.

        Statistics are computed per `(attribute, entity_type, entity_type_name)`
        where:

        - `entity_type` is either:
            - `"event"` for rows coming from the event table
            - `"object"` for rows coming from the object table / object changes
        - `entity_type_name` is:
            - the activity name for events
            - the object type name for objects

        For each group, the method computes:
        - number of distinct non-null values
        - total number of non-null values
        - inferred value type
        - min/max values (numeric when numeric, lexicographic otherwise)

        Parameters
        ----------
        object_types:
            Object types to include (applies to base objects and object changes).
            None means "all".
        activities:
            Event activities to include. None means "all".
        attributes:
            Optional list of attribute columns to summarize. None means "all
            available attributes".

        Returns
        -------
        pandas.DataFrame
            A dataframe indexed by (`ATTRIBUTE_COL`, `ENTITY_TYPE`,
            `ENTITY_TYPE_NAME`) with columns including:
            `distinct_values`, `type`, `min`, `max`.
        """

        merged = self._merged_att_table(
            object_types=object_types, attributes=attributes, activities=activities
        )

        attribute_names = [col for col in merged.columns if col not in [OTYPE_COL, ACTIVITY_COL]]

        # TODO: Make this better readable
        return pd.DataFrame(
            [
                ([group[0], "object"] if pd.notna(group[0]) else [group[1], "activity"])
                + (summarize_attribute_values(col, group_df)[:-2])
                for group, group_df in merged.groupby(
                    list(set([OTYPE_COL, ACTIVITY_COL]) & set(merged.columns)), dropna=False
                )[attribute_names]
                for col in group_df.dropna(axis=1, how="all").columns
            ],
            columns=[
                ENTITY_TYPE_NAME,
                ENTITY_TYPE,
                ATTRIBUTE_COL,
                "type",
                "min",
                "max",
                "distinct_values",
            ],
        ).set_index([ENTITY_TYPE_NAME, ENTITY_TYPE, ATTRIBUTE_COL])

    def get_object_summary(
        self, attributes: list[str] | None = None, object_types: list[str] | None = None
    ):
        """Summarize attributes for objects, grouped by object type.

        Convenience wrapper around `get_summary(...)` restricted to object rows.
        The returned index is shaped like `(ATTRIBUTE_COL, OTYPE_COL)`.

        Parameters
        ----------
        attributes:
            Optional list of object attribute columns to summarize. None means "all
            available attributes".
        object_types:
            Object types to include. None means "all".

        Returns
        -------
        pandas.DataFrame
            A dataframe indexed by (`ATTRIBUTE_COL`, `OTYPE_COL`) with columns
            including: `distinct_values`, `total`, `type`, `min`, `max`.
        """
        return (
            self.get_summary(activities=[], attributes=attributes, object_types=object_types)
            .droplevel(ENTITY_TYPE)
            .rename_axis(index={ENTITY_TYPE_NAME: OTYPE_COL})
        )

    def get_activity_summary(
        self,
        attributes: list[str] | None = None,
        activities: list[str] | None = None,
    ):
        """Summarize attributes for events, grouped by activity.

        Convenience wrapper around `get_summary(...)` restricted to event rows.
        The returned index is shaped like `(ATTRIBUTE_COL, ACTIVITY_COL)`.

        Parameters
        ----------
        attributes:
            Optional list of event attribute columns to summarize. None means "all
            available attributes".
        activities:
            Activities to include. None means "all".

        Returns
        -------
        pandas.DataFrame
            A dataframe indexed by (`ATTRIBUTE_COL`, `ACTIVITY_COL`) with columns
            including: `distinct_values`, `total`, `type`, `min`, `max`.
        """

        return (
            self.get_summary(object_types=[], attributes=attributes, activities=activities)
            .droplevel(ENTITY_TYPE)
            .rename_axis(index={ENTITY_TYPE_NAME: ACTIVITY_COL})
        )
