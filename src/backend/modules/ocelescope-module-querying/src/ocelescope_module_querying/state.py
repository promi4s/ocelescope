from ocelescope_module_querying.api.schemas import AnalyticalType

SchemaOverrideKey = tuple[str, str, str]


class QueryingState:
    def __init__(self) -> None:
        self._schema_overrides: dict[str, dict[SchemaOverrideKey, AnalyticalType]] = {}

    def get_schema_overrides(
        self, ocel_id: str
    ) -> dict[SchemaOverrideKey, AnalyticalType]:
        return self._schema_overrides.get(ocel_id, {}).copy()

    def set_schema_overrides(
        self,
        ocel_id: str,
        overrides: dict[SchemaOverrideKey, AnalyticalType],
    ) -> None:
        self._schema_overrides[ocel_id] = overrides.copy()
