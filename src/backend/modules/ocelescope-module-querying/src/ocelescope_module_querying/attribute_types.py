from __future__ import annotations

import numpy as np
import pandas as pd

from ocelescope.ocel.constants import ValueType
from ocelescope.util.pandas import infer_column_dtype

from ocelescope_module_querying.api.schemas import AnalyticalType, AttributeDataType
from ocelescope_module_querying.errors import InvalidAnalysisQuery


def attribute_type(series: pd.Series) -> AttributeDataType:
    inferred = infer_column_dtype(series)
    if inferred in {ValueType.INT, ValueType.FLOAT}:
        return "number"
    if inferred == ValueType.STRING:
        return "string"
    if inferred == ValueType.BOOL:
        return "boolean"
    if inferred == ValueType.DATE:
        return "datetime"
    return "unknown"


def infer_analytical_type(
    series: pd.Series, physical_type: AttributeDataType
) -> AnalyticalType:
    if physical_type in {"boolean", "string"}:
        return "categorical"
    if physical_type == "datetime":
        return "temporal"
    if physical_type == "number":
        numeric = pd.to_numeric(series, errors="coerce").to_numpy(dtype=float)
        finite = numeric[np.isfinite(numeric)]
        integer_valued = finite.size > 0 and bool(
            np.all(np.isclose(finite, np.round(finite)))
        )
        return "discrete" if integer_valued else "continuous"
    return "unknown"


def supported_analytical_types(
    physical_type: AttributeDataType,
) -> list[AnalyticalType]:
    supported: dict[AttributeDataType, list[AnalyticalType]] = {
        "number": ["discrete", "continuous", "categorical"],
        "string": ["categorical"],
        "boolean": ["categorical"],
        "datetime": ["temporal", "categorical"],
        "unknown": ["unknown", "categorical"],
    }
    return supported[physical_type]


def effective_analytical_type(
    values: pd.Series,
    physical_type: AttributeDataType,
    override: AnalyticalType | None,
) -> AnalyticalType:
    inferred = infer_analytical_type(values, physical_type)
    if override is None:
        return inferred
    if override not in supported_analytical_types(physical_type):
        raise InvalidAnalysisQuery(
            f"'{override}' is not a valid interpretation for {physical_type} values"
        )
    return override
