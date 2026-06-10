from dataclasses import dataclass
from typing import Literal


@dataclass
class AttributeInfo:
    name: str
    type: Literal["numeric", "categorical"]


@dataclass
class Range:
    """Concrete numeric range — both endpoints always set."""

    min: float
    max: float


@dataclass
class HistogramBin:
    start: float
    end: float
    count: int


@dataclass
class HistogramCounts:
    covered: int
    missing: int
    total: int


@dataclass
class HistogramResult:
    bins: list[HistogramBin]
    domain: Range | None
    covered: Range | None
    counts: HistogramCounts
