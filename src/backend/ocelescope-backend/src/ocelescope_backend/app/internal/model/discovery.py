from typing import Any

from pydantic import BaseModel, Field

from ocelescope import BaseFilter
from ocelescope_backend.app.internal.model.base import ApiBaseModel, RequestBody


class FilterEnvelope(ApiBaseModel):
    name: str
    payload: dict[str, Any] = Field(default_factory=dict)


class DiscoveryRequest(BaseModel):
    ocel_id: str
    method_id: str
    name: str
    resource_type: str
    parameters: dict[str, Any] = Field(default_factory=dict)
    filters: list[BaseFilter] = Field(default_factory=list)


class CreateDiscoveryTaskBody(RequestBody):
    method_id: str
    parameters: dict[str, Any] = Field(default_factory=dict)
    filters: list[FilterEnvelope] = Field(default_factory=list)


class DiscoveryVariant(ApiBaseModel):
    method_id: str
    resource_type: str
    input_schema: dict[str, Any]


class DiscoveryMethodMeta(ApiBaseModel):
    name: str
    description: str | None = None
    variants: list[DiscoveryVariant]
