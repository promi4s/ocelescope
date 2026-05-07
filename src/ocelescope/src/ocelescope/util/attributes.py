import pandas as pd

from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, OTYPE_COL
from ocelescope.util.pandas import ValueType, infer_column_dtype


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
