"""Grouping one column of values into distribution buckets.

Rows come out in display order, each with a `kind`: `value` or `range`, then
`other` for categories beyond the limit, then `missing` for absent values.
"""

from __future__ import annotations

import math
from collections import Counter
from datetime import date, datetime
from typing import Annotated, Any, Literal

import numpy as np
from pydantic import BaseModel, Field

from ocelescope_module_exploration.log import InvalidQuery, Result


class Categories(BaseModel):
    kind: Literal["categories"]
    limit: int = Field(default=50, ge=1, le=500)


class Bins(BaseModel):
    kind: Literal["bins"]
    count: int | None = Field(default=None, ge=1, le=200)
    """None chooses a count from the data."""


Grouping = Annotated[Categories | Bins, Field(discriminator="kind")]


def buckets(values: list[Any], analytical_type: str, grouping: Grouping) -> Result:
    present = [value for value in values if not _missing(value)]
    missing = len(values) - len(present)

    if isinstance(grouping, Bins):
        if analytical_type not in ("discrete", "continuous"):
            raise InvalidQuery("Binning needs a numeric attribute")
        rows, truncated = _ranges(present, grouping.count), False
    else:
        ordered = analytical_type in ("discrete", "temporal")
        rows, truncated = _categories(present, grouping.limit, ordered)

    if missing:
        rows.append({"label": "Missing", "count": missing, "kind": "missing"})
    return Result(
        rows=rows,
        meta={"total": len(values), "missing": missing, "truncated": truncated},
    )


def _categories(
    values: list[Any], limit: int, ordered: bool
) -> tuple[list[dict[str, Any]], bool]:
    counts = Counter(values)
    # Ordered values read along their scale; others most frequent first, with
    # ties broken by value so the result never depends on row order.
    keys = (
        sorted(counts)
        if ordered
        else sorted(counts, key=lambda value: (-counts[value], str(value)))
    )
    rows: list[dict[str, Any]] = [
        {
            "label": _label(value),
            "value": value,
            "count": counts[value],
            "kind": "value",
        }
        for value in keys[:limit]
    ]
    rest = sum(counts[value] for value in keys[limit:])
    if rest:
        rows.append({"label": "Other", "count": rest, "kind": "other"})
    return rows, bool(rest)


#: Freedman-Diaconis can ask for thousands of bins on a long tail; beyond this
#: many a chart stops being readable. Also the most a client may request.
MAX_BINS = 200


def _ranges(values: list[Any], count: int | None) -> list[dict[str, Any]]:
    """Equal-width bins between the smallest and largest value.

    The width is Freedman-Diaconis unless the client asks for a bin count.
    Whole numbers - whatever their declared type, as counts often arrive as
    floats - get whole-number widths, so no bin falls between two integers.

    Without a requested count, the bins span only the values within Tukey's
    outer fences (3 IQR beyond the quartiles); far outliers are counted in
    `< a` and `> b` buckets. A long tail would otherwise stretch the bins until
    most are empty and the bulk of the data shares one.
    """
    numbers = np.asarray(values, dtype=float)
    if numbers.size == 0:
        return []
    spanned = numbers
    if count is None:
        q1, q3 = np.percentile(numbers, [25, 75])
        fence = 3 * (q3 - q1)
        if fence > 0:
            spanned = numbers[(numbers >= q1 - fence) & (numbers <= q3 + fence)]

    if np.array_equal(numbers, np.round(numbers)):
        rows = _whole_ranges(numbers, spanned, count)
    else:
        rows = _continuous_ranges(numbers, spanned, count)

    low, high = rows[0]["lower"], rows[-1]["upper"]
    below, above = numbers[numbers < low], numbers[numbers > high]
    if below.size:
        rows.insert(0, _overflow(f"< {low:g}", float(below.min()), low, below.size))
    if above.size:
        rows.append(_overflow(f"> {high:g}", high, float(above.max()), above.size))
    return rows


def _continuous_ranges(
    numbers: np.ndarray, spanned: np.ndarray, count: int | None
) -> list[dict[str, Any]]:
    """Bins over the extent of `spanned`, counting the `numbers` inside it."""
    low, high = float(spanned.min()), float(spanned.max())
    if low == high:
        return [_range(f"{low:g}", low, high, int(np.count_nonzero(numbers == low)))]
    width = _width(spanned, high - low, count)
    bins = min(MAX_BINS, max(1, math.ceil((high - low) / width)))
    counts, edges = np.histogram(numbers, bins=bins, range=(low, high))
    return [
        _range(f"{edges[i]:g} – {edges[i + 1]:g}", edges[i], edges[i + 1], n)
        for i, n in enumerate(counts)
    ]


def _whole_ranges(
    numbers: np.ndarray, spanned: np.ndarray, count: int | None
) -> list[dict[str, Any]]:
    """Bins covering whole values: edges sit halfway between integers, and a bin
    `3–5` holds exactly the values 3, 4 and 5."""
    low, high = int(spanned.min()), int(spanned.max())
    extent = high - low + 1  # how many whole values the range holds
    width = max(
        math.ceil(_width(spanned, extent, count)), math.ceil(extent / MAX_BINS), 1
    )
    starts = np.arange(low, high + 1, width)
    counts, _ = np.histogram(numbers, bins=np.append(starts, starts[-1] + width) - 0.5)
    return [
        _range(
            str(start) if width == 1 else f"{start}–{start + width - 1}",
            start,
            start + width - 1,
            n,
        )
        for start, n in zip(starts.tolist(), counts, strict=True)
    ]


def _width(numbers: np.ndarray, extent: float, count: int | None) -> float:
    """The requested width, else Freedman-Diaconis: 2 * IQR / cbrt(n).

    When the interquartile range is zero - most values identical -
    Freedman-Diaconis is undefined, so Sturges' rule decides instead.
    """
    if count:
        return extent / count
    q1, q3 = np.percentile(numbers, [25, 75])
    if q3 > q1:
        return 2 * float(q3 - q1) / numbers.size ** (1 / 3)
    return extent / (math.ceil(math.log2(numbers.size)) + 1)


def _range(label: str, lower: float, upper: float, count: int) -> dict[str, Any]:
    return {
        "label": label,
        "lower": float(lower),
        "upper": float(upper),
        "count": int(count),
        "kind": "range",
    }


def _overflow(label: str, lower: float, upper: float, count: int) -> dict[str, Any]:
    """Outliers beyond the bins. Kind `other`: like folded categories, they are
    no single interval of the scale."""
    return {
        "label": label,
        "lower": float(lower),
        "upper": float(upper),
        "count": int(count),
        "kind": "other",
    }


def _missing(value: Any) -> bool:
    return value is None or (isinstance(value, float) and math.isnan(value))


def _label(value: Any) -> str:
    return value.isoformat() if isinstance(value, (datetime, date)) else str(value)
