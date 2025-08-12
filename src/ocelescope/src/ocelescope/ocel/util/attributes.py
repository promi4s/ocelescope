import warnings
from typing import Annotated, List, Literal, Union

import pandas as pd
import pm4py
from pm4py.objects.ocel.obj import OCEL
from pydantic.dataclasses import dataclass
from pydantic.fields import Field


# --- Attribute Type Models ---
@dataclass
class IntegerAttribute:
    attribute: str
    type: Literal["integer"]
    min: int
    max: int


@dataclass
class FloatAttribute:
    attribute: str
    type: Literal["float"]
    min: float
    max: float


@dataclass
class BooleanAttribute:
    attribute: str
    type: Literal["boolean"]
    true_count: int
    false_count: int


@dataclass
class DateAttribute:
    attribute: str
    type: Literal["date"]
    min: str
    max: str


@dataclass
class NominalAttribute:
    attribute: str
    type: Literal["nominal"]
    num_unique: int


AttributeSummary = Annotated[
    Union[
        IntegerAttribute,
        FloatAttribute,
        BooleanAttribute,
        DateAttribute,
        NominalAttribute,
    ],
    Field(discriminator="type"),
]

# --- Utility Functions ---


def melt_df(df: pd.DataFrame, type_col: str, cols: list[str]) -> pd.DataFrame:
    return (
        df[[type_col] + cols]
        .melt(id_vars=type_col, var_name="attribute", value_name="value")
        .dropna(subset=["value"])
    )


def is_boolean_series_fast(lower_vals: pd.Series) -> bool:
    valid = {"true", "false", "yes", "no", "0", "1"}
    return set(lower_vals.unique()).issubset(valid) and lower_vals.nunique() <= 2


# --- Main Attribute Summary Logic ---


def summarize_attributes(df: pd.DataFrame, type_column: str) -> dict[str, List[AttributeSummary]]:
    summary_by_type: dict[str, List[AttributeSummary]] = {}

    grouped = df.groupby([type_column, "attribute"])

    for (type_name, attr), group in grouped:  # type:ignore
        values = group["value"].dropna()
        str_vals = values.astype(str)
        lower_vals = str_vals.str.lower()

        attribute_type = "unknown"
        numeric_values = None
        date_values = None

        # Try boolean
        if is_boolean_series_fast(lower_vals):
            attribute_type = "boolean"

        # Try numeric
        if attribute_type == "unknown":
            try:
                numeric_values = pd.to_numeric(values, errors="raise")
                if (numeric_values % 1 == 0).all():  # type:ignore
                    attribute_type = "integer"
                    numeric_values = numeric_values.astype(int)  # type:ignore
                else:
                    attribute_type = "float"
            except Exception:
                pass

        # Try date
        if attribute_type == "unknown":
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore", UserWarning)
                    date_values = pd.to_datetime(values, errors="coerce")
                if date_values.notna().all():
                    attribute_type = "date"
            except Exception:
                pass

        # Fallback to nominal
        if attribute_type == "unknown":
            attribute_type = "nominal"

        # Create summary
        match attribute_type:
            case "integer":
                summary = IntegerAttribute(
                    attribute=attr,
                    type="integer",
                    min=int(numeric_values.min()),  # type:ignore
                    max=int(numeric_values.max()),  # type:ignore
                )
            case "float":
                summary = FloatAttribute(
                    attribute=attr,
                    type="float",
                    min=float(numeric_values.min()),  # type:ignore
                    max=float(numeric_values.max()),  # type:ignore
                )
            case "boolean":
                true_count = lower_vals.isin(["true", "yes", "1"]).sum()
                false_count = len(values) - true_count
                summary = BooleanAttribute(
                    attribute=attr,
                    type="boolean",
                    true_count=true_count,
                    false_count=false_count,
                )
            case "date":
                summary = DateAttribute(
                    attribute=attr,
                    type="date",
                    min=str(date_values.min()),  # type:ignore
                    max=str(date_values.max()),  # type:ignore
                )
            case "nominal":
                summary = NominalAttribute(
                    attribute=attr,
                    type="nominal",
                    num_unique=values.nunique(),  # type:ignore
                )

        summary_by_type.setdefault(type_name, []).append(summary)

    return summary_by_type


# --- OCEL Integration Functions ---
def summarize_event_attributes(ocel: OCEL) -> dict[str, list[AttributeSummary]]:
    event_attribute_names = [
        col for col in pm4py.ocel_get_attribute_names(ocel) if col in ocel.events.columns
    ]

    melted_event_attributes = melt_df(ocel.events, ocel.event_activity, event_attribute_names)

    return summarize_attributes(melted_event_attributes, ocel.event_activity)


def summarize_object_attributes(ocel: OCEL) -> dict[str, list[AttributeSummary]]:
    obj_type_col = ocel.object_type_column

    attribute_names = pm4py.ocel_get_attribute_names(ocel)
    object_cols = [col for col in attribute_names if col in ocel.objects.columns]
    object_changes_cols = [col for col in attribute_names if col in ocel.object_changes.columns]

    melted_objects = melt_df(ocel.objects.replace("null", pd.NA), obj_type_col, object_cols)
    melted_changes = melt_df(
        ocel.object_changes.replace("null", pd.NA), obj_type_col, object_changes_cols
    )

    metadata = pd.concat([melted_objects, melted_changes], ignore_index=True)

    return summarize_attributes(metadata, obj_type_col)


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

    # Combine the original objects with latest changes
    return objects.fillna(object_changes_filtered).reset_index()
