from enum import StrEnum

from pydantic import BaseModel


class ValueType(StrEnum):
    EMPTY = "empty"
    STRING = "string"
    BOOL = "bool"
    INT = "int"
    FLOAT = "float"
    DATE = "date"


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
