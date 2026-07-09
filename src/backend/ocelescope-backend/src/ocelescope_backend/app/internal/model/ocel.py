from pathlib import Path
from typing import Hashable, Self, Sequence, cast

import pandas as pd
from ocelescope.ocel.constants import ValueType
from ocelescope.ocel.io import load_ocel_duckdb
from ocelescope.ocel.models.meta import OCELMeta
from pydantic.main import BaseModel

from ocelescope import (
    OCEL,
)
from ocelescope_backend.app.internal.registry.extension import OCELExtensionDescription
from ocelescope_backend.app.modules.base import ModuleFilter


class OcelMetadata(BaseModel):
    id: str
    name: str
    created_at: str
    extensions: list[OCELExtensionDescription]
    filter_applied: bool | None

    @classmethod
    def from_handle(cls, handle: "SessionOCEL", filter_applied: bool | None = None):
        return cls(
            id=handle.id,
            created_at=handle.created_at,
            name=handle.name,
            extensions=[],
            filter_applied=filter_applied,
        )


class SessionOCEL:
    """A handle to an OCEL persisted as a DuckDB file on disk.

    The OCEL is not kept in memory; it is materialized on demand from ``db_path``
    via :func:`load_ocel_duckdb` and the applied filter pipeline is re-applied
    lazily, so only the OCELs actively in use ever occupy RAM.
    """

    def __init__(self, id: str, db_path: Path, name: str, created_at: str):
        self.id = id
        self.db_path = db_path
        self.name = name
        self.created_at = created_at
        self._applied_filter: list[ModuleFilter] = []

    def _meta(self) -> OCELMeta:
        return OCELMeta(
            id=self.id, extra={"name": self.name, "upload_date": self.created_at}
        )

    def ocel(self, use_original: bool = False) -> OCEL:
        origin = load_ocel_duckdb(self.db_path, meta=self._meta())
        if use_original or not self._applied_filter:
            return origin
        return origin.filter(self._applied_filter)

    @property
    def is_filtered(self) -> bool:
        return len(self._applied_filter) > 0

    def delete(self) -> None:
        self.db_path.unlink(missing_ok=True)

    def get_filters(self, module_source: str | None) -> list[ModuleFilter]:
        return [
            filterItem
            for filterItem in self._applied_filter
            if module_source is None
            or filterItem.OcelescopeModuleSource == module_source
        ]

    def set_filters(self, module_source: str, pipeline: Sequence[ModuleFilter]):
        self._applied_filter = [
            filter
            for filter in self._applied_filter
            if filter.OcelescopeModuleSource != module_source
        ] + [
            module_filter
            for module_filter in pipeline
            if module_filter.OcelescopeModuleSource == module_source
        ]


class Attribute(BaseModel):
    name: str
    min: str | int | float
    max: str | int | float
    distinct_values: int
    type: ValueType

    @classmethod
    def from_df_row(cls, row: tuple[Hashable, pd.Series]) -> Self:
        attribute_name = cast(str, row[0])
        series = row[1]

        return cls(
            name=attribute_name,
            min=series["min"],
            max=series["max"],
            distinct_values=series["distinct_values"],
            type=series["type"],
        )

    @classmethod
    def from_df(cls, df: pd.DataFrame) -> list[Self]:
        return [cls.from_df_row(row) for row in df.iterrows()]


class AggregatedAttribute(Attribute):
    entity_type_names: list[str]

    @classmethod
    def from_df_row(cls, row: tuple[Hashable, pd.Series]) -> Self:
        base = Attribute.from_df_row(row)

        return cls(
            entity_type_names=row[1]["object_types"] + row[1]["activities"],
            **base.model_dump(),
        )


class TypedAttribute(Attribute):
    entity_type: str

    @classmethod
    def from_df_row(cls, row: tuple[Hashable, pd.Series]) -> "TypedAttribute":
        index = cast(tuple[str, str], row[0])
        entity_type = index[0]
        base = Attribute.from_df_row((index[1], row[1]))

        return cls(
            entity_type=entity_type,
            **base.model_dump(),
        )


class QuantityInfo(BaseModel):
    item_types: list[str]
    total_object_count: int
    total_event_count: int
    object_types: list[str]
    activities: list[str]

    @classmethod
    def from_ocel(cls, ocel: OCEL) -> Self:
        return cls(
            item_types=ocel.quantities.item_types,
            total_object_count=len(ocel.quantities.objects),
            total_event_count=len(ocel.quantities.events),
            object_types=ocel.quantities.object_types,
            activities=ocel.quantities.activities,
        )
