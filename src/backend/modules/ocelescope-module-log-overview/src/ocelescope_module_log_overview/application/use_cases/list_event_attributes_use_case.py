from ocelescope import OCEL

from ocelescope_module_log_overview.domain.models import AttributeInfo
from ocelescope_module_log_overview.infrastructure.ocel_helpers import (
    detect_attribute_type,
    iter_event_attribute_columns,
)


class ListEventAttributesUseCase:
    def __init__(self, ocel: OCEL) -> None:
        self._ocel = ocel

    def execute(self) -> dict[str, list[AttributeInfo]]:
        result: dict[str, list[AttributeInfo]] = {}
        for event_type, name, series in iter_event_attribute_columns(self._ocel):
            attrs = result.setdefault(event_type, [])
            attrs.append(AttributeInfo(name=name, type=detect_attribute_type(series)))
        return result
