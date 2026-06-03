import pandas as pd
import pm4py
from pm4py.objects.ocel.obj import OCEL

from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, OTYPE_COL
from ocelescope.util.pandas import ValueType, infer_column_dtype


def get_objects_with_object_changes(ocel: OCEL):
    object_changes = ocel.object_changes

    grouped = object_changes.groupby([ocel.object_id_column, ocel.object_type_column])
    last_changes = grouped.last().reset_index()

    attribute_names = pm4py.ocel_get_attribute_names(ocel)
    available_cols = last_changes.columns.tolist()
    selected_cols = [ocel.object_id_column] + [
        col for col in attribute_names if col in available_cols
    ]

    object_changes_filtered = last_changes[selected_cols]

    object_changes_filtered = object_changes_filtered.set_index(ocel.object_id_column)
    objects = ocel.objects.set_index(ocel.object_id_column)

    return objects.fillna(object_changes_filtered).reset_index()


def summarize_attribute_values(attr_name: str, attr_table: pd.DataFrame):
    attr_col = attr_table[attr_name].dropna()

    activities = (
        list(attr_table.loc[attr_table[attr_name].notna(), ACTIVITY_COL].dropna().unique())
        if ACTIVITY_COL in attr_table
        else []
    )

    object_types = (
        list(attr_table.loc[attr_table[attr_name].notna(), OTYPE_COL].dropna().unique())
        if OTYPE_COL in attr_table
        else []
    )

    attr_type = infer_column_dtype(attr_col)

    match attr_type:
        case ValueType.STRING:
            attr_col = attr_col.astype("str")
        case ValueType.INT | ValueType.FLOAT:
            attr_col = pd.to_numeric(attr_col, errors="coerce")

    return [
        attr_name,
        attr_type,
        attr_col.min(numeric_only=False),
        attr_col.max(numeric_only=False),
        attr_col.nunique(),
        activities,
        object_types,
    ]
