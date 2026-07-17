from __future__ import annotations

import math

import numpy as np
import pandas as pd

from ocelescope_module_querying.api.schemas import (
    AnalyticalType,
    DistributionBucket,
    DistributionGrouping,
    DistributionResponse,
    NumericBinGrouping,
    QueryCounts,
)
from ocelescope_module_querying.errors import InvalidAnalysisQuery

_MIN_AUTO_BINS = 5
_MAX_AUTO_BINS = 80


def _auto_bin_count(values: np.ndarray) -> int:
    count = len(values)
    if count < 2:
        return 1
    span = float(values.max() - values.min())
    if span <= 0:
        return 1
    first_quartile, third_quartile = np.percentile(values, [25, 75])
    interquartile_range = float(third_quartile - first_quartile)
    if interquartile_range > 0:
        width = 2 * interquartile_range * count ** (-1 / 3)
        bins = max(1, math.ceil(span / width))
    else:
        bins = max(1, math.ceil(math.sqrt(count)))
    return max(_MIN_AUTO_BINS, min(_MAX_AUTO_BINS, bins))


def _numeric_buckets(
    values: pd.Series, requested_bins: int | None
) -> tuple[list[DistributionBucket], int]:
    numeric = pd.to_numeric(values, errors="coerce").to_numpy(dtype=float)
    finite_mask = np.isfinite(numeric)
    finite = numeric[finite_mask]
    missing = int((~finite_mask).sum())
    if finite.size == 0:
        return [], missing

    minimum = float(finite.min())
    maximum = float(finite.max())
    if minimum == maximum:
        return (
            [
                DistributionBucket(
                    key="range-0",
                    label=f"{minimum:g}",
                    count=int(finite.size),
                    kind="range",
                    lower=minimum,
                    upper=maximum,
                    inclusive_upper=True,
                )
            ],
            missing,
        )

    counts, edges = np.histogram(
        finite,
        bins=requested_bins or _auto_bin_count(finite),
        range=(minimum, maximum),
    )
    return (
        [
            DistributionBucket(
                key=f"range-{index}",
                label=f"{edges[index]:g} – {edges[index + 1]:g}",
                count=int(count),
                kind="range",
                lower=float(edges[index]),
                upper=float(edges[index + 1]),
                inclusive_upper=index == len(counts) - 1,
            )
            for index, count in enumerate(counts)
        ],
        missing,
    )


def _display_value(value: object) -> str:
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    return str(value)


def _json_value(value: object) -> str | int | float | bool:
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    if isinstance(value, (int, np.integer)):
        return int(value)
    if isinstance(value, (float, np.floating)):
        return float(value)
    return _display_value(value)


def _value_buckets(
    values: pd.Series, limit: int, analytical_type: AnalyticalType
) -> tuple[list[DistributionBucket], int, bool]:
    missing_mask = values.isna()
    counts = values.loc[~missing_mask].value_counts(dropna=True, sort=False)
    if analytical_type in {"discrete", "temporal"}:
        counts = counts.sort_index()
    else:
        counts = counts.sort_values(ascending=False)
    shown = counts.head(limit)
    buckets = [
        DistributionBucket(
            key=f"value-{index}",
            label=_display_value(value),
            count=int(count),
            kind="value",
            value=_json_value(value),
        )
        for index, (value, count) in enumerate(shown.items())
    ]
    truncated = len(counts) > len(shown)
    if truncated:
        buckets.append(
            DistributionBucket(
                key="other",
                label="Other",
                count=int(counts.iloc[len(shown) :].sum()),
                kind="other",
            )
        )
    return buckets, int(missing_mask.sum()), truncated


def calculate_distribution(
    values: pd.Series,
    analytical_type: AnalyticalType,
    grouping: DistributionGrouping,
) -> DistributionResponse:
    """Aggregate any one-dimensional population into a typed distribution."""
    if isinstance(grouping, NumericBinGrouping):
        if analytical_type not in {"discrete", "continuous"}:
            raise InvalidAnalysisQuery("Numeric binning requires a numeric attribute")
        buckets, missing = _numeric_buckets(values, grouping.count)
        truncated = False
    else:
        buckets, missing, truncated = _value_buckets(
            values, grouping.limit, analytical_type
        )

    if missing:
        buckets.append(
            DistributionBucket(
                key="missing",
                label="Missing",
                count=missing,
                kind="missing",
            )
        )

    total = len(values)
    return DistributionResponse(
        buckets=buckets,
        counts=QueryCounts(
            total=total,
            present=total - missing,
            missing=missing,
            represented=sum(bucket.count for bucket in buckets),
        ),
        truncated=truncated,
    )
