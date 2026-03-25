from __future__ import annotations

import numpy as np
import pandas as pd


# Generated from Langdock
def infer_value_type(s: pd.Series) -> str:
    s = s.dropna()
    if s.empty:
        return "empty"

    if s.dtype != "object":
        return str(s.dtype)

    sample = s.head(200)
    types = {type(x) for x in sample}

    if len(types) == 1:
        t = next(iter(types))
        if t is str:
            return "str"
        if t is bool:
            return "bool"
        if t in (int, np.int64, np.int32):
            return "int"
        if t in (float, np.float64, np.float32):
            return "float"
        if isinstance(sample.iloc[0], (pd.Timestamp,)):
            return "datetime"
        return t.__name__

    numeric_types = (int, float, np.integer, np.floating)
    if all(issubclass(t, numeric_types) for t in types):
        return "numeric"

    if any(issubclass(t, (pd.Timestamp,)) for t in types):
        return "datetime/mixed"

    return "mixed"


def str_min(s: pd.Series):
    x = s.dropna()
    if x.empty:
        return pd.NA
    return x.astype(str).min()


def str_max(s: pd.Series):
    x = s.dropna()
    if x.empty:
        return pd.NA
    return x.astype(str).max()


def num_min(s: pd.Series):
    x = pd.to_numeric(s, errors="coerce")
    return x.min(skipna=True)


def num_max(s: pd.Series):
    x = pd.to_numeric(s, errors="coerce")
    return x.max(skipna=True)
