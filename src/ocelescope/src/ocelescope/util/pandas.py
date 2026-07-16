from __future__ import annotations

import warnings

import pandas as pd


def coerce_series(series: pd.Series) -> pd.Series:
    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore",
            message="Could not infer format",
            category=UserWarning,
        )

        try:
            return pd.to_numeric(series, errors="raise")
        except Exception:
            pass

        try:
            return pd.to_datetime(series, errors="raise")
        except Exception:
            pass

        return series.astype(str)
