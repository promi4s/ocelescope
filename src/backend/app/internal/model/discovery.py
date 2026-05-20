from typing import Any

from pydantic import BaseModel, Field

from app.internal.model.base import ApiBaseModel, RequestBody


class DiscoveryRequest(BaseModel):
    ocel_id: str
    method_id: str
    name: str
    resource_type: str
    parameters: dict[str, Any] = Field(default_factory=dict)


class CreateDiscoveryTaskBody(RequestBody):
    method_id: str
    parameters: dict[str, Any] = Field(default_factory=dict)


class DiscoveryVariant(ApiBaseModel):
    method_id: str
    resource_type: str


class DiscoveryMethodMeta(ApiBaseModel):
    name: str
    description: str | None = None
    input_schema: dict[str, Any]
    variants: list[DiscoveryVariant]
