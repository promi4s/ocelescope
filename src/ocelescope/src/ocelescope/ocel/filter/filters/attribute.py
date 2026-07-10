from typing import Optional, Tuple, Union, cast

import pandas as pd
from pandas.api.types import is_datetime64_any_dtype, is_numeric_dtype
from pandas.core.frame import DataFrame
from pandas.core.series import Series
from pydantic.main import BaseModel

from ocelescope.ocel.util.attributes import get_objects_with_object_changes

from ..base import BaseFilter, FilterResult


class AttributeFilterConfig(BaseModel):
    target_type: Optional[str] = None
    attribute: str

    # Range filters
    time_range: Optional[Tuple[Optional[str], Optional[str]]] = None
    number_range: Optional[Tuple[Optional[Union[int, float]], Optional[Union[int, float]]]] = None

    # Nominal filters
    values: Optional[list[Union[str, int, float]]] = None
    regex: Optional[str] = None


def filter_by_attribute(attribute_df: DataFrame, type_column: str, config: AttributeFilterConfig):
    df = attribute_df
    col = config.attribute

    if col not in df.columns:
        scope = config.target_type if config.target_type is not None else "any"
        raise ValueError(f"Attribute '{col}' not found in {scope} data")

    series = cast(Series, df[col])
    mask = pd.Series(True, index=series.index)

    if config.number_range is not None:
        if is_numeric_dtype(series):
            numeric_series = series
        else:
            numeric_series = pd.to_numeric(series, errors="coerce")

        if config.number_range[0] is not None:
            mask &= numeric_series >= float(config.number_range[0])  # type:ignore
        if config.number_range[1] is not None:
            mask &= numeric_series <= float(config.number_range[1])  # type:ignore

    elif config.time_range is not None:
        if is_datetime64_any_dtype(series):
            date_series = series
        else:
            date_series = pd.to_datetime(series, errors="coerce")

        if config.time_range[0] is not None:
            mask &= date_series >= pd.to_datetime(config.time_range[0])
        if config.time_range[1] is not None:
            mask &= date_series <= pd.to_datetime(config.time_range[1])

    if config.values is not None:
        mask &= series.isin(config.values)

    if config.regex is not None:
        mask &= series.astype(str).str.contains(config.regex, regex=True, na=False)

    if config.target_type is not None:
        is_unaffected = attribute_df[type_column] != config.target_type
    else:
        types_with_attribute = attribute_df.loc[series.notna(), type_column].unique()
        is_unaffected = ~attribute_df[type_column].isin(types_with_attribute)

    final_mask = cast(Series, is_unaffected | mask)
    return final_mask


class EventAttributeFilter(BaseFilter, AttributeFilterConfig):
    def filter(self, ocel):
        return FilterResult(
            events=filter_by_attribute(
                ocel.events.df,
                ocel.ocel.event_activity,
                config=AttributeFilterConfig(**self.model_dump()),
            )
        )


class ObjectAttributeFilter(BaseFilter, AttributeFilterConfig):
    def filter(self, ocel):
        enriched_objects = get_objects_with_object_changes(ocel.ocel)

        filtered_rows = enriched_objects[
            filter_by_attribute(
                enriched_objects,
                ocel.ocel.object_type_column,
                config=AttributeFilterConfig(**self.model_dump()),
            )
        ]
        valid_ids = filtered_rows[ocel.ocel.object_id_column].unique()  # type:ignore

        return FilterResult(
            objects=ocel.ocel.objects[ocel.ocel.object_id_column].isin(valid_ids)  # type:ignore
        )
