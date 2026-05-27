from collections.abc import Iterator
from typing import Literal

import numpy as np
import pandas as pd
from ocelescope import OCEL
from ocelescope.ocel.constants.pm4py import ACTIVITY_COL

# Maximum fraction of non-null values that may be lost when coercing strings
# to numeric before we treat the column as categorical.
_COERCE_LOSS_THRESHOLD = 0.05

_RESERVED_EVENT_COLUMNS = frozenset({ACTIVITY_COL, "ocel:timestamp", "ocel:eid"})


def get_event_attribute_series(ocel: OCEL, event_type: str, attribute: str) -> pd.Series:
    """Return the raw series for one event-type/attribute, with NaN for missing values.

    Raises KeyError if the event type or attribute is unknown.
    """
    df = ocel.events.df
    mask = df[ACTIVITY_COL] == event_type
    if not mask.any():
        raise KeyError(f"Event type '{event_type}' not found")
    group = df[mask]
    if attribute not in group.columns:
        raise KeyError(f"Attribute '{attribute}' not found for event type '{event_type}'")
    return group[attribute].reset_index(drop=True)


def iter_event_attribute_columns(ocel: OCEL) -> Iterator[tuple[str, str, pd.Series]]:
    """Yield (event_type, attribute_name, series) for every user-defined event attribute."""
    df = ocel.events.df
    for event_type, group in df.groupby(ACTIVITY_COL):
        for col in group.columns:
            if col in _RESERVED_EVENT_COLUMNS:
                continue
            yield str(event_type), col, group[col]


def extract_attribute(
    ocel: OCEL, event_type: str, attribute: str
) -> tuple[pd.Series, int, int]:
    """Fetch an attribute and split into (non_null_series, missing_count, total_count)."""
    series = get_event_attribute_series(ocel, event_type, attribute)
    total_count = len(series)
    non_null = series.dropna()
    return non_null, total_count - len(non_null), total_count


def detect_attribute_type(series: pd.Series) -> Literal["numeric", "categorical"]:
    """Classify a series as numeric or categorical based on its values."""
    non_null = series.dropna()
    if len(non_null) == 0:
        return "categorical"

    if pd.api.types.is_numeric_dtype(non_null):
        arr = non_null.to_numpy(dtype=float)
        return "numeric" if np.isfinite(arr).any() else "categorical"

    coerced = pd.to_numeric(non_null, errors="coerce")
    loss = coerced.isna().sum() / len(non_null)
    return "numeric" if loss <= _COERCE_LOSS_THRESHOLD else "categorical"


def to_finite_numeric_array(series: pd.Series) -> np.ndarray | None:
    """Convert a non-null series to a finite float array, or None if not numeric."""
    if pd.api.types.is_numeric_dtype(series):
        arr = series.to_numpy(dtype=float)
        return arr[np.isfinite(arr)]

    coerced = pd.to_numeric(series, errors="coerce")
    if coerced.isna().sum() / len(series) > _COERCE_LOSS_THRESHOLD:
        return None

    arr = coerced.dropna().to_numpy(dtype=float)
    return arr[np.isfinite(arr)]
