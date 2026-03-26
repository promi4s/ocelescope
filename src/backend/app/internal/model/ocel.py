from typing import Hashable, Self, TypedDict, cast

import pandas as pd
from ocelescope.ocel.constants import ValueType
from pydantic.main import BaseModel

from app.internal.registry.extension import OCELExtensionDescription
from ocelescope import (
    OCEL,
    BaseFilter,
    E2OCountFilter,
    EventAttributeFilter,
    EventTypeFilter,
    O2OCountFilter,
    ObjectAttributeFilter,
    ObjectTypeFilter,
    TimeFrameFilter,
)


class OcelMetadata(BaseModel):
    id: str
    name: str
    created_at: str
    extensions: list[OCELExtensionDescription]


class UploadingOcelMetadata(BaseModel):
    task_id: str


class OcelListResponse(BaseModel):
    ocels: list[OcelMetadata]


# TODO: Remove this concept completly
class OCELFilter(TypedDict, total=False):
    object_types: ObjectTypeFilter
    event_type: EventTypeFilter
    time_range: TimeFrameFilter
    o2o_count: list[O2OCountFilter]
    e2o_count: list[E2OCountFilter]
    event_attributes: list[EventAttributeFilter]
    object_attributes: list[ObjectAttributeFilter]


class SessionOCEL:
    def __init__(self, ocel: OCEL):
        self.origin: OCEL = ocel
        self.applied_filter: list[BaseFilter] = []
        self._filtered_ocel: OCEL = ocel

    @property
    def ocel(self):
        return self._filtered_ocel

    def apply_filter(self, pipeline: list[BaseFilter]):
        self.applied_filter = pipeline
        self._filtered_ocel = (
            self.origin.filter(self.applied_filter)
            if len(self.applied_filter) >= 0
            else self.origin
        )


class Attribute(BaseModel):
    name: str
    min: str | int | float
    max: str | int | float
    distinct_values: int
    total_values: int
    type: ValueType

    @classmethod
    def from_df_row(cls, row: tuple[Hashable, pd.Series]) -> Self:

        attribute_name = cast(tuple[str, ...], row[0])[0]
        series = row[1]

        return cls(
            name=attribute_name,
            min=series["min"],
            max=series["max"],
            distinct_values=series["distinct_values"],
            total_values=series["total"],
            type=series["type"],
        )

    @classmethod
    def from_df(cls, df: pd.DataFrame) -> list[Self]:
        return [cls.from_df_row(row) for row in df.iterrows()]


class TypedAttribute(Attribute):
    entity_type: str

    @classmethod
    def from_df_row(cls, row: tuple[Hashable, pd.Series]) -> "TypedAttribute":
        entity_type = cast(tuple[str, str], row[0])[1]
        base = Attribute.from_df_row(row)

        return cls(entity_type=entity_type, **base.model_dump())
