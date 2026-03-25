from __future__ import annotations

from enum import StrEnum

import numpy as np
import pandas as pd


class ValueType(StrEnum):
    EMPTY = "empty"
    OBJECT = "object"
    STRING = "string"
    BOOL = "bool"
    INT = "int"
    FLOAT = "float"
    DATE = "date"
    NUMERIC = "numeric"
    DATE_MIXED = "date_mixed"
    MIXED = "mixed"


def infer_value_type(s: pd.Series) -> ValueType:
    s = s.dropna()
    if s.empty:
        return ValueType.EMPTY

    sample = s.head(200).to_list()

    if all(isinstance(x, str) for x in sample):
        return ValueType.STRING
    if all(isinstance(x, (bool, np.bool_)) for x in sample):
        return ValueType.BOOL
    if all(isinstance(x, (pd.Timestamp, np.datetime64)) for x in sample):
        return ValueType.DATE

    if all(isinstance(x, (int, float, np.integer, np.floating)) for x in sample):
        if all(
            isinstance(x, (int, np.integer)) and not isinstance(x, (bool, np.bool_)) for x in sample
        ):
            return ValueType.INT
        if all(isinstance(x, (float, np.floating)) for x in sample):
            return ValueType.FLOAT
        return ValueType.NUMERIC

    if any(isinstance(x, (pd.Timestamp, np.datetime64)) for x in sample):
        return ValueType.DATE_MIXED

    return ValueType.MIXED


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
