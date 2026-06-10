from ocelescope.ocel.constants import ACTIVITY_COL, ATTRIBUTE_COL, ValueType

from ocelescope import OCEL
from ocelescope_module_exploration.domain.models import AttributeInfo

_NUMERIC_VALUE_TYPES = {ValueType.INT, ValueType.FLOAT}


class ListEventAttributesUseCase:
    def __init__(self, ocel: OCEL) -> None:
        self._ocel = ocel

    def execute(self) -> dict[str, list[AttributeInfo]]:
        summary = self._ocel.attributes.get_activity_summary()
        if summary.empty:
            return {}

        rows = summary.reset_index()[[ATTRIBUTE_COL, ACTIVITY_COL, "type"]]
        result: dict[str, list[AttributeInfo]] = {}
        for activity, group in rows.groupby(ACTIVITY_COL):
            result[str(activity)] = [
                AttributeInfo(
                    name=str(row[ATTRIBUTE_COL]),
                    type="numeric"
                    if row["type"] in _NUMERIC_VALUE_TYPES
                    else "categorical",
                )
                for _, row in group.iterrows()
            ]
        return result
