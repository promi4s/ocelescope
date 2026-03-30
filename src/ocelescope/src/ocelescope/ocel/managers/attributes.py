import numpy as np
import pandas as pd

from ocelescope.ocel.constants import ACTIVITY_COL
from ocelescope.ocel.constants.attributes import ATTRIBUTE_COL
from ocelescope.ocel.constants.pm4py import EID_COL, OID_COL, OTYPE_COL, TIMESTAMP_COL
from ocelescope.ocel.managers.base import BaseManager
from ocelescope.util.pandas import (
    infer_column_dtype,
    num_max,
    num_min,
    select_min_max_by_type,
    str_max,
    str_min,
)

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
        event_table = (
            self._ocel.events.df
            if activities is None
            else self._ocel.events.df[self._ocel.events.df[ACTIVITY_COL].isin(activities)]
        )

        object_table = pd.concat(
            [self._ocel.objects.df, self._ocel.objects.changes]
            if object_types is None
            else [
                self._ocel.objects.df[self._ocel.objects.df[OTYPE_COL].isin(object_types)],
                self._ocel.objects.changes[
                    self._ocel.objects.changes[OTYPE_COL].isin(object_types)
                ],
            ],
            ignore_index=True,
            sort=False,
        )

        merged = (
            pd.concat([event_table, object_table], ignore_index=True, sort=False)
            .drop(columns=["ocel:field", "@@cumcount", "new_value"], errors="ignore")
            .replace(["null", ""], pd.NA)
        )

        if attributes is not None:
            wanted = [OID_COL, EID_COL, OTYPE_COL, ACTIVITY_COL, TIMESTAMP_COL, *attributes]
            columns = [c for c in dict.fromkeys(wanted) if c in merged.columns]
            merged = merged.loc[:, columns]

        return merged

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
            `distinct_values`, `total`, `type`, `min`, `max`, `activities`,
            `object_types`.
        """
        attribute_table = (
            self._merged_att_table(
                object_types=object_types, activities=activities, attributes=attributes
            )
            .drop(columns=[EID_COL, OID_COL, TIMESTAMP_COL], errors="ignore")
            .melt(id_vars=[OTYPE_COL, ACTIVITY_COL], var_name=ATTRIBUTE_COL, value_name="value")
            .dropna(subset=["value"])
            .groupby([ATTRIBUTE_COL], sort=False)
            .agg(
                distinct_values=("value", "nunique"),
                min_str=("value", str_min),
                max_str=("value", str_max),
                min_num=("value", num_min),
                max_num=("value", num_max),
                total=("value", "size"),
                type=("value", infer_column_dtype),
                activities=(ACTIVITY_COL, lambda x: x.dropna().unique().tolist()),
                object_types=(OTYPE_COL, lambda x: x.dropna().unique().tolist()),
            )
        )

        return select_min_max_by_type(attribute_table, "type")

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
            `distinct_values`, `total`, `type`, `min`, `max`.
        """
        attribute_table = self._merged_att_table(
            object_types=object_types, activities=activities, attributes=attributes
        )

        attribute_table[ENTITY_TYPE] = np.where(
            attribute_table[ACTIVITY_COL].isna(), "object", "event"
        )
        attribute_table[ENTITY_TYPE_NAME] = attribute_table[ACTIVITY_COL].fillna(
            attribute_table[OTYPE_COL]
        )

        attribute_table = (
            attribute_table.drop(
                columns=[EID_COL, OID_COL, TIMESTAMP_COL, ACTIVITY_COL, OTYPE_COL], errors="ignore"
            )
            .melt(
                id_vars=[ENTITY_TYPE, ENTITY_TYPE_NAME],
                var_name=ATTRIBUTE_COL,
                value_name="value",
            )
            .dropna(subset=["value"])
            .groupby([ATTRIBUTE_COL, ENTITY_TYPE, ENTITY_TYPE_NAME], sort=False)
            .agg(
                distinct_values=("value", "nunique"),
                min_str=("value", str_min),
                max_str=("value", str_max),
                min_num=("value", num_min),
                max_num=("value", num_max),
                total=("value", "size"),
                type=("value", infer_column_dtype),
            )
        )

        return select_min_max_by_type(attribute_table, "type")

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
