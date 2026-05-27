from ocelescope import OCEL
from ocelescope_module_log_overview.domain.models import (
    CategoricalEntry,
    CategoricalResult,
)
from ocelescope_module_log_overview.infrastructure.ocel_helpers import extract_attribute


class ComputeEventCategoricalUseCase:
    def __init__(self, ocel: OCEL) -> None:
        self._ocel = ocel

    def execute(
        self,
        event_type: str,
        attribute: str,
        *,
        top_k: int | None = 20,
    ) -> CategoricalResult:
        non_null, missing_count, total_count = extract_attribute(
            self._ocel, event_type, attribute
        )
        vc = non_null.astype(str).value_counts(dropna=True)
        truncated = top_k is not None and len(vc) > top_k
        if truncated:
            vc = vc.iloc[:top_k]

        return CategoricalResult(
            value_counts=[
                CategoricalEntry(value=str(v), count=int(c)) for v, c in vc.items()
            ],
            missing_count=missing_count,
            total_count=total_count,
            truncated=truncated,
        )
