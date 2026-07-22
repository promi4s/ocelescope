from __future__ import annotations

from typing import Literal, cast

import numpy as np
import pandas as pd


def int_median_str(
    r50: float, check: bool = True, mode: Literal["number", "string"] = "string"
):
    """Formats a median of integers as string, either returning <n> or <n>.5"""
    i50 = int(np.round(r50))
    if not np.isclose(i50, r50):
        i50 = np.round(r50 * 2) / 2
    if check:
        assert np.isclose(i50, r50)
    return str(i50) if mode == "string" else i50


def search_paginated_dataframe(
    df: pd.DataFrame,
    page_size: int,
    page: int,
    search_column: str | None = None,
    query: str | None = None,
) -> pd.DataFrame:
    filtered = cast(
        pd.DataFrame,
        df[df[search_column].str.contains(query, case=False, na=False)]
        if search_column and query
        else df,
    )

    start = (page - 1) * page_size
    end = start + page_size

    return filtered.iloc[start:end]
