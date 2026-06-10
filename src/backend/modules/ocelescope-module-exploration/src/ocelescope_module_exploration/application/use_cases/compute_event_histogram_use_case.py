import math

import numpy as np

from ocelescope import OCEL
from ocelescope_module_exploration.domain.models import (
    HistogramBin,
    HistogramCounts,
    HistogramResult,
    Range,
)
from ocelescope_module_exploration.infrastructure.ocel_helpers import (
    extract_attribute,
    to_finite_numeric_array,
)

_MIN_AUTO_BINS = 5
_MAX_AUTO_BINS = 80


def _auto_bin_count(arr: np.ndarray, span: float) -> int:
    """Freedman-Diaconis rule with a sqrt(n) fallback when IQR collapses to 0."""
    n = len(arr)
    if n < 2 or span <= 0:
        return 1

    q1, q3 = np.percentile(arr, [25, 75])
    iqr = float(q3 - q1)
    if iqr > 0:
        bin_width = 2 * iqr * (n ** (-1 / 3))
        count = max(1, math.ceil(span / bin_width))
    else:
        count = max(1, math.ceil(math.sqrt(n)))

    return max(_MIN_AUTO_BINS, min(_MAX_AUTO_BINS, count))


class ComputeEventHistogramUseCase:
    def __init__(self, ocel: OCEL) -> None:
        self._ocel = ocel

    def execute(
        self,
        event_type: str,
        attribute: str,
        *,
        range_min: float | None = None,
        range_max: float | None = None,
        bins: int | None = None,
    ) -> HistogramResult:
        non_null, missing_count, total_count = extract_attribute(
            self._ocel, event_type, attribute
        )
        full_arr = to_finite_numeric_array(non_null) if len(non_null) > 0 else None

        empty_counts = HistogramCounts(
            covered=0, missing=missing_count, total=total_count
        )

        if full_arr is None or len(full_arr) == 0:
            return HistogramResult(
                bins=[], domain=None, covered=None, counts=empty_counts
            )

        domain = Range(min=float(full_arr.min()), max=float(full_arr.max()))

        lo = domain.min if range_min is None else max(range_min, domain.min)
        hi = domain.max if range_max is None else min(range_max, domain.max)

        if lo > hi:
            return HistogramResult(
                bins=[], domain=domain, covered=None, counts=empty_counts
            )

        covered_arr = full_arr[(full_arr >= lo) & (full_arr <= hi)]
        covered_count = int(covered_arr.size)
        span = hi - lo
        counts = HistogramCounts(
            covered=covered_count, missing=missing_count, total=total_count
        )

        if covered_count == 0:
            return HistogramResult(
                bins=[], domain=domain, covered=Range(min=lo, max=hi), counts=counts
            )

        if span == 0:
            return HistogramResult(
                bins=[HistogramBin(start=lo, end=hi, count=covered_count)],
                domain=domain,
                covered=Range(min=lo, max=hi),
                counts=counts,
            )

        bin_count = bins if bins is not None else _auto_bin_count(covered_arr, span)
        bin_counts, edges = np.histogram(covered_arr, bins=bin_count, range=(lo, hi))

        return HistogramResult(
            bins=[
                HistogramBin(
                    start=float(edges[i]),
                    end=float(edges[i + 1]),
                    count=int(bin_counts[i]),
                )
                for i in range(len(bin_counts))
            ],
            domain=domain,
            covered=Range(min=lo, max=hi),
            counts=counts,
        )
