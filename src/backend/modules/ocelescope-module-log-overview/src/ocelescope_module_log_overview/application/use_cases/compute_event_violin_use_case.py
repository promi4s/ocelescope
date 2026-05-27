import numpy as np
from ocelescope import OCEL
from scipy.stats import gaussian_kde

from ocelescope_module_log_overview.domain.models import (
    KdePoint,
    ViolinResult,
    ViolinStats,
)
from ocelescope_module_log_overview.infrastructure.ocel_helpers import (
    extract_attribute,
    to_finite_numeric_array,
)


class ComputeEventViolinUseCase:
    def __init__(self, ocel: OCEL) -> None:
        self._ocel = ocel

    def execute(
        self,
        event_type: str,
        attribute: str,
        *,
        n_points: int = 200,
    ) -> ViolinResult:
        non_null, missing_count, total_count = extract_attribute(self._ocel, event_type, attribute)
        arr = to_finite_numeric_array(non_null) if len(non_null) > 0 else None

        if arr is None or len(arr) < 2:
            return ViolinResult(
                kde_points=[],
                stats=None,
                missing_count=missing_count,
                total_count=total_count,
            )

        kde = gaussian_kde(arr)
        margin = (arr.max() - arr.min()) * 0.1
        x = np.linspace(arr.min() - margin, arr.max() + margin, n_points)
        y = kde(x)

        return ViolinResult(
            kde_points=[KdePoint(x=float(xi), y=float(yi)) for xi, yi in zip(x, y)],
            stats=ViolinStats(
                min=float(arr.min()),
                max=float(arr.max()),
                q1=float(np.percentile(arr, 25)),
                median=float(np.percentile(arr, 50)),
                q3=float(np.percentile(arr, 75)),
            ),
            missing_count=missing_count,
            total_count=total_count,
        )
