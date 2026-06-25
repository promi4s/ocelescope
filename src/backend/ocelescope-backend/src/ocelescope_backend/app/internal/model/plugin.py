from abc import ABC
from typing import Annotated, Literal, Self, cast

from pydantic import BaseModel, Field

from ocelescope import (
    OCEL,
    PluginMeta,
    PluginMethod,
    Resource,
    Visualization,
)


class PluginApi(BaseModel):
    id: str
    meta: PluginMeta
    methods: list[PluginMethod]


class PluginOutputBase(ABC, BaseModel):
    result_index: int


class OCELOutput(PluginOutputBase):
    type: Literal["ocel"]
    activity_count: dict[str, int]
    object_count: dict[str, int]

    @classmethod
    def from_ocel(cls, index: int, ocel: OCEL) -> Self:
        return cls(
            type="ocel",
            result_index=index,
            activity_count=ocel.events.activity_counts.to_dict(),
            object_count=ocel.objects.counts.to_dict(),
        )


class ResourceOutput(PluginOutputBase):
    type: Literal["resource"]
    resource_type: str
    visualization: Visualization | None

    @classmethod
    def from_resource(cls, index: int, resource: Resource):
        return cls(
            type="resource",
            result_index=index,
            resource_type=resource.label or resource.get_type(),
            visualization=cast(Visualization, resource.visualize()),
        )


PluginOutput = Annotated[OCELOutput | ResourceOutput, Field(discriminator="type")]
