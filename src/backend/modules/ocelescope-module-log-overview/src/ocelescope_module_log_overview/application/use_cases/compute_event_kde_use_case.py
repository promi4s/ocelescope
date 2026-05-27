import numpy as np
from ocelescope import OCEL
from scipy.stats import gaussian_kde

from ocelescope_module_log_overview.domain.models import KdePoint, KdeResult
from ocelescope_module_log_overview.infrastructure.ocel_helpers import (
    extract_attribute,
    to_finite_numeric_array,
)


class ComputeEventKdeUseCase:
    def __init__(self, ocel: OCEL) -> None:
        self._ocel = ocel

    def execute(
        self,
        event_type: str,
        attribute: str,
        *,
        n_points: int = 200,
        bandwidth: float = 1.0,
    ) -> KdeResult:
        non_null, missing_count, total_count = extract_attribute(self._ocel, event_type, attribute)
        arr = to_finite_numeric_array(non_null) if len(non_null) > 0 else None

        if arr is None or len(arr) < 2:
            return KdeResult(points=[], missing_count=missing_count, total_count=total_count)

        # bandwidth is a multiplier applied to Scott's rule (1.0 = default).
        kde = gaussian_kde(arr, bw_method=lambda obj: obj.scotts_factor() * bandwidth)
        margin = (arr.max() - arr.min()) * 0.1
        x = np.linspace(arr.min() - margin, arr.max() + margin, n_points)
        y = kde(x)

        return KdeResult(
            points=[KdePoint(x=float(xi), y=float(yi)) for xi, yi in zip(x, y)],
            missing_count=missing_count,
            total_count=total_count,
        )
