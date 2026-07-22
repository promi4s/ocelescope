from __future__ import annotations

from typing import Literal

import numpy as np
import pandas as pd

from ocelescope.ocel.constants import ValueType
from ocelescope.util.pandas import infer_column_dtype

AttributeDataType = Literal["number", "string", "boolean", "datetime", "unknown"]
AnalyticalType = Literal["categorical", "discrete", "continuous", "temporal", "unknown"]


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
