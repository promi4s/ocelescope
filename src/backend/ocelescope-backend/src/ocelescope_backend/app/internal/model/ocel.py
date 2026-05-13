from typing import Hashable, Self, TypedDict, cast

import pandas as pd
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
from ocelescope.ocel.constants import ValueType
from pydantic.main import BaseModel

from ocelescope_backend.app.internal.registry import registry_manager
from ocelescope_backend.app.internal.registry.extension import OCELExtensionDescription


class OcelMetadata(BaseModel):
    id: str
    name: str
    created_at: str
    extensions: list[OCELExtensionDescription]

    @classmethod
    def from_ocel(cls, ocel: OCEL):
        extension_descriptions = registry_manager.get_extension_descriptions()

        return cls(
            id=ocel.meta.id,
            created_at=ocel.meta.extra["upload_date"],
            name=ocel.meta.extra["name"],
            extensions=[
                extension_descriptions[extension.__class__.__name__]
                for extension in ocel.extensions.all()
                if extension.__class__.__name__ in extension_descriptions
            ],
        )


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
    object_types: list[str]
    actitvities: list[str]

    @classmethod
    def from_df_row(cls, row: tuple[Hashable, pd.Series]) -> Self:

        base = Attribute.from_df_row(row)

        return cls(
            object_types=row[1]["object_types"],
            actitvities=row[1]["activities"],
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
