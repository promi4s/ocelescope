from typing import Literal

from pydantic import BaseModel

from ocelescope_module_querying.shared.attribute_types import (
    AnalyticalType,
    AttributeDataType,
)


class AttributeSchemaItem(BaseModel):
    name: str
    physical_type: AttributeDataType
    analytical_type: AnalyticalType
    present_count: int
    missing_count: int
    distinct_count: int


class ActivitySchemaItem(BaseModel):
    name: str
    event_count: int
    attributes: list[AttributeSchemaItem]


class ObjectAttributeSchemaItem(AttributeSchemaItem):
    behavior: Literal["static", "dynamic"]
    initial_present_count: int
    current_present_count: int
    observed_value_count: int
    change_count: int
    changed_object_count: int


class ObjectTypeSchemaItem(BaseModel):
    name: str
    object_count: int
    attributes: list[ObjectAttributeSchemaItem]


class AnalyticalSchemaResponse(BaseModel):
    schema_version: Literal["1"] = "1"
    activities: list[ActivitySchemaItem]
    object_types: list[ObjectTypeSchemaItem]
