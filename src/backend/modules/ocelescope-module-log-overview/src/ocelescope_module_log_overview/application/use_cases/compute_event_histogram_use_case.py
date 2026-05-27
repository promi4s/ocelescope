import numpy as np
from ocelescope import OCEL

from ocelescope_module_log_overview.domain.models import HistogramBin, HistogramResult
from ocelescope_module_log_overview.infrastructure.ocel_helpers import (
    extract_attribute,
    to_finite_numeric_array,
)


class ComputeEventHistogramUseCase:
    def __init__(self, ocel: OCEL) -> None:
        self._ocel = ocel

    def execute(
        self,
        event_type: str,
        attribute: str,
        *,
        bins: int | None = None,
    ) -> HistogramResult:
        non_null, missing_count, total_count = extract_attribute(self._ocel, event_type, attribute)
        arr = to_finite_numeric_array(non_null) if len(non_null) > 0 else None

        if arr is None or len(arr) == 0:
            return HistogramResult(bins=[], missing_count=missing_count, total_count=total_count)

        counts, edges = np.histogram(arr, bins=bins if bins is not None else "auto")

        return HistogramResult(
            bins=[
                HistogramBin(
                    start=float(edges[i]),
                    end=float(edges[i + 1]),
                    count=int(counts[i]),
                )
                for i in range(len(counts))
            ],
            missing_count=total_count - len(arr),
            total_count=total_count,
        )
