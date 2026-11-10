from enum import StrEnum
from typing import Literal

from pydantic import BaseModel


class ValueType(StrEnum):
    EMPTY = "empty"
    STRING = "string"
    BOOL = "bool"
    INT = "int"
    FLOAT = "float"
    DATE = "date"


AnalyticalType = Literal["categorical", "discrete", "continuous", "temporal", "unknown"]


class AttributeStats(BaseModel):
    name: str
    type: ValueType
    min: str | int | float
    max: str | int | float
    distinct_values: int
    entity_types: list[str]


class TypedAttribute(BaseModel):
    name: str
    min: str | int | float
    max: str | int | float
    distinct_values: int
    type: ValueType
    entity_type: str


class AttributeValueCount(BaseModel):
    value: str
    count: int


class AttributeValues(BaseModel):
    count: int
    distinct_values: int
    values: list[AttributeValueCount]


class AttributeInfo(BaseModel):
    name: str
    type: ValueType
    entity_types: list[str]


class AttributeSummary(BaseModel):
    type: ValueType
    count: int
    missing: int
    distinct_values: int
    min: str | float | None
    max: str | float | None
    dynamic: bool = False
