from __future__ import annotations

from typing import Callable, Hashable, Literal, Sequence

import numpy as np
import pandas as pd
from pandas.core.groupby.generic import DataFrameGroupBy, SeriesGroupBy


def prepend_level(
    x: pd.DataFrame | pd.Series,
    /,
    label: Hashable,
    *,
    axis: Literal[0, 1, "index", "columns"] = "columns",
    name: str | None = None,
):
    """Adds an extra index level on a DataFrame's columns or index. The new level has just one constant value."""
    is_columns = axis in [1, "columns"]
    if isinstance(x, pd.DataFrame):
        old_names = x.columns.names if is_columns else x.index.names
    elif isinstance(x, pd.Series):
        if is_columns:
            old_names = [x.name]
            x = x.to_frame()
        else:
            old_names = x.index.names
    else:
        raise TypeError
    return pd.concat({label: x}, axis=axis, names=[name, *old_names])


def unique_non_null(s):
    return s.dropna().unique()


def int_median_str(r50: float, check: bool = True, mode: Literal["number", "string"] = "string"):
    """Formats a median of integers as string, either returning <n> or <n>.5"""
    i50 = int(np.round(r50))
    if not np.isclose(i50, r50):
        i50 = np.round(r50 * 2) / 2
    if check:
        assert np.isclose(i50, r50)
    return str(i50) if mode == "string" else i50


def make_compact(
    x: dict[str, float | int] | NumSeriesAgg,
    latex: bool = True,
    siunitx: bool = True,
    unit: str | None = None,
    dtype: type = float,
    format: str = ".2f",
):
    if not siunitx and unit is not None:
        raise ValueError
    if isinstance(x, NumSeriesAgg):
        rmin, r50, rmax = x._min, x._median, x._max
    else:
        rmin, r50, rmax = x["min"], x["50%"], x["max"]
    if dtype is int:
        imin, imax = int(rmin), int(rmax)
        # median is either integer or ?.5
        i50 = int_median_str(r50, check=False, mode="number")
        assert np.allclose([imin, i50, imax], [rmin, r50, rmax]), (
            "make_compact received non-integer values when passing dtype=int."
        )
        fmin, f50, fmax = str(imin), str(i50), str(imax)
    else:
        fmin, f50, fmax = f"{rmin:{format}}", f"{r50:{format}}", f"{rmax:{format}}"
    if rmin == rmax:
        if latex and siunitx:
            return f"\\num{{{fmin}}}"
        return fmin

    if latex:
        escape_percent = lambda s: s.replace("%", "\\%")
        strip_percent = lambda s: s.replace("%", "")
        if siunitx:
            ispercentage = format.endswith("%")
            if ispercentage:
                assert unit is None
                fmin, f50, fmax = map(strip_percent, (fmin, f50, fmax))
                unit = "\\percent"
            if unit is not None:
                return f"\\qty{{{f50}}}{{{unit}}} [\\qtyrange{{{fmin}}}{{{fmax}}}{{{unit}}}]"
            return f"\\num{{{f50}}} [\\numrange{{{fmin}}}{{{fmax}}}]"
            # return f"\\num{{{f50}}} [\\num{{{fmin}}} -- \\num{{{fmax}}}]"
        else:
            fmin, f50, fmax = map(escape_percent, (fmin, f50, fmax))
            return f"{f50} [{fmin} -- {fmax}]"
    else:
        return f"{f50} [{fmin} - {fmax}]"


def agg_compact(xs: pd.Series, **kwargs):
    return make_compact(
        {
            "min": xs.min(),
            "50%": xs.median(),
            "max": xs.max(),
        },
        **kwargs,
    )


def infer_dtype(x):
    isinteger = False
    if isinstance(x, pd.DataFrame):
        isinteger = (x.dtypes == np.int64).all()
    elif isinstance(x, pd.Series):
        isinteger = x.dtype == np.int64
    elif isinstance(x, SeriesGroupBy):
        isinteger = (x.dtype == np.int64).all()
    elif isinstance(x, DataFrameGroupBy):
        raise TypeError("dtype cannot be inferred from DataFrameGroupBy")
    return int if isinteger else float


def is_int(x: pd.DataFrame | pd.Series):
    if infer_dtype(x) is int:
        return True
    if isinstance(x, pd.DataFrame):
        values = x.values.flatten()
        values = values[~np.isnan(values)]
    elif isinstance(x, pd.Series):
        values = x[x.notna()]
    else:
        raise TypeError
    return np.allclose(np.round(values), values)


def mmmmstr(
    x,
    /,
    *,
    nonzero: bool = False,
    latex: bool = True,
    siunitx: bool = True,
    unit: str | None = None,
    dtype: type | None = None,
    axis: Literal[0, 1] | None = None,
    **compact_kwargs,
):
    return mmmm(
        x,
        compact=True,
        nonzero=nonzero,
        latex=latex,
        siunitx=siunitx,
        unit=unit,
        dtype=dtype,
        axis=axis,
        **compact_kwargs,
    )


def mmmm(
    x,
    /,
    *,
    nonzero: bool = False,
    sum: bool = False,
    compact: bool = False,
    latex: bool = True,
    siunitx: bool = True,
    unit: str | None = None,
    dtype: type | None = None,
    asobj: bool = False,
    axis: Literal[0, 1] | None = None,
    **compact_kwargs,
):
    """Applies aggregation to mean, min, median, max.
    Applicable to Series, DataFrame, or groupby.
    When passing nonzero=True, includes the fraction of non-zero values.
    When passing compact=True, returns a string representation like "median (min-max)".
    """
    # Infer dtype
    if dtype is None:
        dtype = infer_dtype(x)
    agg_nonzero = lambda xs: (xs != 0).sum() / len(xs)
    # is_int = pd.api.types.is_integer_dtype(x)
    agg_kwargs = {}
    if axis is not None:
        if isinstance(x, pd.DataFrame):
            agg_kwargs["axis"] = axis
        else:
            raise ValueError

    agg = ["mean", "min", "median", "max"]
    if nonzero:
        agg.append(agg_nonzero)  # type: ignore
    if sum:
        agg.append("sum")
    y = x.agg(agg, **agg_kwargs)  # type: ignore
    renamer = {"median": "50%", "<lambda>": "nonzero", "<lambda_0>": "nonzero"}
    _make_compact = lambda x1: make_compact(
        x1, latex=latex, siunitx=siunitx, dtype=dtype, unit=unit, **compact_kwargs
    )
    _agg_compact = lambda x1: agg_compact(
        x1, latex=latex, siunitx=siunitx, dtype=dtype, unit=unit, **compact_kwargs
    )
    _agg_obj = lambda x1: NumSeriesAgg.agg(
        x1, nonzero=nonzero, dtype=dtype, unit=unit, **compact_kwargs
    )
    _obj_from_dict = lambda y1: NumSeriesAgg.from_dict(
        y1, latex=latex, siunitx=siunitx, dtype=dtype, unit=unit, **compact_kwargs
    )

    if isinstance(x, pd.Series) and isinstance(y, pd.Series):
        y.rename(index=renamer, inplace=True)
        # y.columns = ["mean", "min", "50%", "max"]
    elif isinstance(x, pd.DataFrame) and isinstance(y, pd.DataFrame):
        y.rename(renamer, inplace=True, axis=axis)
    elif isinstance(x, DataFrameGroupBy) and isinstance(y, pd.DataFrame):
        # if asobj:
        #     return x.agg(_agg_obj)
        if compact:
            return x.agg(_agg_compact)
        y.rename(columns=renamer, inplace=True, level=1)
    elif isinstance(x, SeriesGroupBy) and isinstance(y, pd.DataFrame):
        if asobj:
            return x.agg(_agg_obj)
        if compact:
            return x.agg(_agg_compact)
        y.rename(columns=renamer, inplace=True)
    else:
        raise TypeError

    if asobj:
        raise NotImplementedError
        if isinstance(x, pd.Series):
            return _obj_from_dict(y)
            # y.columns = ["mean", "min", "50%", "max"]
        elif isinstance(x, pd.DataFrame):
            return y.apply(_obj_from_dict)
    if compact:
        if isinstance(x, pd.Series):
            return _make_compact(y)
            # y.columns = ["mean", "min", "50%", "max"]
        elif isinstance(x, pd.DataFrame):
            return y.apply(_make_compact)

    return y


# display(mmmm(pd.Series([1, 2, 3])))
# display(mmmm(pd.DataFrame({"A": [1, 2, 3]})))
# display(mmmm(pd.DataFrame({"A": [1, 2, 3], "B": [1, 2, 3]})))
# display(mmmm(pd.DataFrame({"A": [1, 2, 3, 4, 5], "B": [1, 2, 3, 4, 5], "G": ["X", "X", "Y", "Y", "Y"]}).groupby("G")))


class NumSeriesAgg:
    def __init__(
        self,
        _mean,
        _min,
        _median,
        _max,
        _nonzero,
        dtype: type = float,
        **compact_kwargs,
    ):
        self._mean = _mean
        self._min = _min
        self._median = _median
        self._max = _max
        self._nonzero = _nonzero
        self.dtype = dtype
        self.compact_kwargs = compact_kwargs
        raise NotImplementedError("DEPR keep using strings for now")

    @staticmethod
    def from_dict(row: dict[str, float | int] | pd.Series, **compact_kwargs):
        return NumSeriesAgg(
            _mean=row.get("mean", None),
            _min=row["min"],
            _median=row["50%"],
            _max=row["max"],
            _nonzero=row.get("nonzero", None),
            **compact_kwargs,
        )

    @staticmethod
    def agg(x: pd.Series, nonzero: bool, **compact_kwargs):
        return NumSeriesAgg(
            _mean=x.mean(),
            _min=x.min(),
            _median=x.median(),
            _max=x.max(),
            _nonzero=((x != 0).sum() / len(x) if len(x) else 0) if nonzero else None,
            **compact_kwargs,
        )

    def __str__(self):
        return make_compact(
            self,
            latex=False,
            dtype=self.dtype,
            **self.compact_kwargs,
        )

    def __format__(self, format_spec=".2f"):
        return make_compact(
            self,
            # latex=True,
            # siunitx=siunitx,
            dtype=self.dtype,
            format=format_spec,
            **self.compact_kwargs,
        )

    def __repr__(self):
        return str(self)

    def to_latex(self, siunitx: bool = True):
        return make_compact(
            self,
            latex=True,
            siunitx=siunitx,
            dtype=self.dtype,
            **self.compact_kwargs,
        )


def series_to_nested_dict(x: pd.Series, values: list | None = None):
    """Converts a Series with a multiindex to a nested dictionary."""
    result = {}
    if values is None:
        values = x.tolist()
    elif len(values) != len(x):
        raise ValueError
    for (idx, _), value in zip(x.items(), values):
        idx = tuple(i if not pd.isna(i) else None for i in idx)  # type: ignore
        d = result
        for key in idx[:-1]:
            d = d.setdefault(key, {})
        d[idx[-1]] = value
    return result


def mirror_dataframe(
    df: pd.DataFrame,
    suffix1: str | int = "_1",
    suffix2: str | int = "_2",
):
    """For a given pandas DataFrame, swaps columns with given suffixes"""
    suffix1, suffix2 = str(suffix1), str(suffix2)
    if suffix1.endswith(suffix2) or suffix2.endswith(suffix1):
        raise NotImplementedError(
            "mirror_dataframe does not support suffixes that are a suffix of each other."
        )
    column_order = df.columns

    def remove_suffix1(col1: str):
        return col1[: -len(suffix1)]

    def remove_suffix2(col2: str):
        return col2[: -len(suffix2)]

    renamer = {}
    for col1 in df.columns:
        if col1.endswith(suffix1):
            col = remove_suffix1(col1)
            col2 = col + suffix2
            if col2 not in df.columns:
                raise ValueError(f"mirror_dataframe: Column {col2} not found.")
            renamer[col1] = col2
            renamer[col2] = col1
    for col2 in df.columns:
        if col2.endswith(suffix2):
            col = remove_suffix2(col2)
            col1 = col + suffix1
            if col1 not in df.columns:
                raise ValueError(f"mirror_dataframe: Column {col1} not found.")
    return df.rename(columns=renamer)[column_order]


def concat_dfs(
    dfs: Sequence[pd.DataFrame | None],
    columns: list[str] | None = None,
    **kwargs,
) -> pd.DataFrame:
    """Concatenate multiple DataFrames (axis=0). pd.concat has problems with empty DataFrames.
    Even if all dfs are empty, this function is able to concatenate them. To ensure reproducible results, pass a columns list.
    """
    _columns = columns
    if _columns is None:
        _columns = []
        for df in dfs:
            if df is not None:
                _columns += [col for col in df.columns if col not in _columns]
    dfs = [df for df in dfs if df is not None and not df.empty]
    if not dfs:
        return pd.DataFrame([], columns=_columns)
        # raise ValueError("No dataframes to concatenate")
    res = pd.concat(dfs, **kwargs)
    if columns is not None:
        return res.reindex(columns=columns)
    return res


def first_in_group(
    group: DataFrameGroupBy | pd.DataFrame | pd.Series,
    /,
    value: Callable[[pd.DataFrame], pd.Series] | str,
    condition: Callable[[pd.DataFrame], pd.Series] | str | None = None,
):
    if isinstance(group, DataFrameGroupBy):
        call = lambda g: first_in_group(g, value=value, condition=condition)
        return group.apply(call, include_groups=False)  # type: ignore

    if condition is None:
        filtered_group = group
    elif isinstance(condition, str):
        filtered_group = group[group[condition]]
    else:
        filtered_group = group[condition(group)]  # type: ignore

    if filtered_group.empty:
        return None
    # Return the first value inside filtered group
    if isinstance(value, str):
        values = filtered_group[value]
    else:
        values = value(filtered_group)  # type: ignore
    return values.iloc[0]


# first_in_group(
#     pd.DataFrame(
#         [
#             {"A": 1, "B": 0, "C": False},
#             {"A": 1, "B": 42, "C": True},
#             {"A": 2, "B": 0, "C": False},
#             {"A": 2, "B": 52, "C": True},
#             {"A": 2, "B": 0, "C": True},
#         ]
#     ).groupby("A"),
#     value="B",
#     condition="C",
# )


def index_order(order: list[str], subset: list[str] | None = None):
    """To be used as key for df.sort_index.
    Pass the desired order of index values as a list. For MultiIndex, allows specifying a subset of level names.
    """
    indices = {x: i for i, x in enumerate(order)}
    n = len(order)

    def sorter(ix: pd.Index):
        if subset is not None and ix.name not in subset:
            # return ix
            return np.full_like(ix, np.nan)
        return [indices.get(k, n) for k in ix]

    return sorter
