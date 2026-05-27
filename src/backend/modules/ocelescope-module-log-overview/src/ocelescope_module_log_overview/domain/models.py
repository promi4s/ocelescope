from dataclasses import dataclass
from typing import Literal


@dataclass
class AttributeInfo:
    name: str
    type: Literal["numeric", "categorical"]


@dataclass
class HistogramBin:
    start: float
    end: float
    count: int


@dataclass
class HistogramResult:
    bins: list[HistogramBin]
    missing_count: int
    total_count: int


@dataclass
class CategoricalEntry:
    value: str
    count: int


@dataclass
class CategoricalResult:
    value_counts: list[CategoricalEntry]
    missing_count: int
    total_count: int
    truncated: bool


@dataclass
class KdePoint:
    x: float
    y: float


@dataclass
class KdeResult:
    points: list[KdePoint]
    missing_count: int
    total_count: int


@dataclass
class ViolinStats:
    min: float
    max: float
    q1: float
    median: float
    q3: float


@dataclass
class ViolinResult:
    kde_points: list[KdePoint]
    stats: ViolinStats | None
    missing_count: int
    total_count: int
