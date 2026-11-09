from __future__ import annotations

from ocelescope_module_ocel.models import AttributeValueCount, Bin
from ocelescope_module_ocel.models.attributes import ValueType
from pydantic import BaseModel


class SharedAttribute(BaseModel):
    name: str
    type: ValueType
    entity_types: list[str]


class AttributeValues(BaseModel):
    count: int
    distinct_values: int
    values: list[AttributeValueCount]


class AttributeSummary(BaseModel):
    type: ValueType
    count: int
    missing: int
    distinct_values: int
    min: str | float | None
    max: str | float | None
    dynamic: bool = False


__all__ = [
    "AttributeSummary",
    "AttributeValueCount",
    "AttributeValues",
    "Bin",
    "SharedAttribute",
]
