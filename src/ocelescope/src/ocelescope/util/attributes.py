import pandas as pd

from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, OTYPE_COL
from ocelescope.util.pandas import infer_column_dtype


def summarize_attribute_values(attr_name: str, attr_table: pd.DataFrame):
    attr_col = attr_table[attr_name].dropna()

    activities = (
        list(attr_table.loc[attr_table[attr_name].notna(), ACTIVITY_COL].unique())
        if ACTIVITY_COL in attr_table
        else []
    )

    object_types = (
        list(attr_table.loc[attr_table[attr_name].notna(), OTYPE_COL].unique())
        if OTYPE_COL in attr_table
        else []
    )

    attr_type = infer_column_dtype(attr_col)

    return [
        attr_name,
        attr_type,
        attr_col.min(),
        attr_col.max(),
        attr_col.nunique(),
        activities,
        object_types,
    ]
