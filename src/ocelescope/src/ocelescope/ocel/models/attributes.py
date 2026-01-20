from dataclasses import dataclass
from typing import Annotated, Literal

from pydantic import Field


@dataclass
class IntegerAttribute:
    """
    Summary information for an integer attribute.

    Attributes:
        attribute (str):
            Name of the attribute.
        type (Literal["integer"]):
            The attribute’s inferred data type ("integer").
        min (int):
            The minimum observed value.
        max (int):
            The maximum observed value.
    """

    attribute: str
    type: Literal["integer"]
    min: int
    max: int


@dataclass
class FloatAttribute:
    """
    Summary information for a floating-point numerical attribute.

    Attributes:
        attribute (str):
            Name of the attribute.
        type (Literal["float"]):
            The attribute’s inferred data type ("float").
        min (float):
            The minimum observed value.
        max (float):
            The maximum observed value.
    """

    attribute: str
    type: Literal["float"]
    min: float
    max: float


@dataclass
class BooleanAttribute:
    """
    Summary information for a boolean attribute.

    Attributes:
        attribute (str):
            Name of the attribute.
        type (Literal["boolean"]):
            The attribute’s inferred data type ("boolean").
        true_count (int):
            Number of events or objects where the value was True.
        false_count (int):
            Number of events or objects where the value was False.
    """

    attribute: str
    type: Literal["boolean"]
    true_count: int
    false_count: int


@dataclass
class DateAttribute:
    """
    Summary information for a date or timestamp attribute.

    Attributes:
        attribute (str):
            Name of the attribute.
        type (Literal["date"]):
            The attribute’s inferred data type ("date").
        min (str):
            The earliest observed value (ISO timestamp string).
        max (str):
            The latest observed value (ISO timestamp string).
    """

    attribute: str
    type: Literal["date"]
    min: str
    max: str


@dataclass
class NominalAttribute:
    """
    Summary information for a categorical (nominal) attribute.

    Attributes:
        attribute (str):
            Name of the attribute.
        type (Literal["nominal"]):
            The attribute’s inferred data type ("nominal").
        num_unique (int):
            Number of distinct categories observed.
    """

    attribute: str
    type: Literal["nominal"]
    num_unique: int


AttributeSummary = Annotated[
    IntegerAttribute | FloatAttribute | BooleanAttribute | DateAttribute | NominalAttribute,
    Field(discriminator="type"),
]
"""
Union type for all supported attribute summary structures.

This type is used as the return value for attribute summarization,
where each attribute is represented by one of the specialized
summary dataclasses depending on its inferred type.

The ``type`` field is used as a discriminator, enabling Pydantic
to correctly parse the variant.

Possible variants:
    - IntegerAttribute
    - FloatAttribute
    - BooleanAttribute
    - DateAttribute
    - NominalAttribute
"""
