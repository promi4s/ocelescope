from __future__ import annotations

import warnings
from enum import StrEnum

import numpy as np
import pandas as pd


class ValueType(StrEnum):
    EMPTY = "empty"
    STRING = "string"
    BOOL = "bool"
    INT = "int"
    FLOAT = "float"
    DATE = "date"


TRUE_VALUES = [True, "True", "true", "yes", "1"]
FALSE_VALUES = [False, "false", "no", "0"]


def infer_column_dtype(series: pd.Series) -> ValueType:
    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore",
            message="Could not infer format",
            category=UserWarning,
        )

        s = series.dropna()

        if s.empty:
            return ValueType.EMPTY

        if s.isin(TRUE_VALUES + FALSE_VALUES).all():
            return ValueType.BOOL

        try:
            s_int = pd.to_numeric(s, errors="raise")
            if (s_int % 1 == 0).all():
                return ValueType.INT
        except Exception:
            pass

        try:
            pd.to_numeric(s, errors="raise")
            return ValueType.FLOAT
        except Exception:
            pass

        try:
            pd.to_datetime(s, errors="raise")
            return ValueType.DATE
        except Exception:
            pass

        return ValueType.STRING


def coerce_series(series: pd.Series) -> pd.Series:
    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore",
            message="Could not infer format",
            category=UserWarning,
        )

        s = series.dropna()

        try:
            return pd.to_numeric(s, errors="raise")
        except Exception:
            pass

        try:
            return pd.to_datetime(s, errors="raise")
        except Exception:
            pass

        return series


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


def select_min_max_by_type(
    df: pd.DataFrame,
    type_col: str,
    str_cols: tuple[str, str] = ("min_str", "max_str"),
    number_cols: tuple[str, str] = ("min_num", "max_num"),
):
    num_mask = df[type_col].isin([ValueType.FLOAT, ValueType.INT])

    df["min"] = np.where(
        num_mask,
        df[number_cols[0]],
        df[str_cols[0]],
    )

    df["max"] = np.where(
        num_mask,
        df["max_num"],
        df["max_str"],
    )

    return df.drop(columns=[*str_cols, *number_cols])
