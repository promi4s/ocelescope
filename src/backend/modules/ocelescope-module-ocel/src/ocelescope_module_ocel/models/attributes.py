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


class Attribute(BaseModel):
    name: str
    min: str | int | float
    max: str | int | float
    distinct_values: int
    type: ValueType


class AggregatedAttribute(Attribute):
    """An attribute summarized across every entity type that carries it."""

    entity_type_names: list[str]


class TypedAttribute(Attribute):
    """An attribute summarized for a single entity type (activity / object type)."""

    entity_type: str


class AttributeBin(BaseModel):
    start: float | str
    end: float | str
    count: int


class AttributeValueCount(BaseModel):
    value: str
    count: int


class AttributeDistribution(BaseModel):
    name: str
    type: ValueType
    count: int
    distinct_values: int
    min: str | int | float
    max: str | int | float
    bins: list[AttributeBin] = []
    values: list[AttributeValueCount] = []


class AttributeMatches(BaseModel):
    count: int
    distinct_values: int
    values: list[AttributeValueCount]
