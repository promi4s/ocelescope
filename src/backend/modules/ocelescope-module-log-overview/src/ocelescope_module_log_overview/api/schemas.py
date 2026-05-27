from typing import Literal

from pydantic import BaseModel, Field

from ocelescope_module_log_overview.domain.models import (
    CategoricalResult,
    HistogramResult,
    KdeResult,
    ViolinResult,
)


class AttributeInfoSchema(BaseModel):
    name: str
    type: Literal["numeric", "categorical"]


class HistogramBody(BaseModel):
    bins: int | None = Field(default=None, ge=1, le=500)


class CategoricalBody(BaseModel):
    top_k: int | None = Field(default=20, ge=1, le=200)


class KdeBody(BaseModel):
    n_points: int = Field(default=200, ge=10, le=1000)
    bandwidth: float = Field(default=1.0, ge=0.1, le=5.0)


class ViolinBody(BaseModel):
    n_points: int = Field(default=200, ge=10, le=1000)


class HistogramBinSchema(BaseModel):
    start: float
    end: float
    count: int


class HistogramSchema(BaseModel):
    bins: list[HistogramBinSchema]
    missing_count: int
    total_count: int

    @classmethod
    def from_domain(cls, result: HistogramResult) -> "HistogramSchema":
        return cls(
            bins=[HistogramBinSchema(start=b.start, end=b.end, count=b.count) for b in result.bins],
            missing_count=result.missing_count,
            total_count=result.total_count,
        )


class CategoricalEntrySchema(BaseModel):
    value: str
    count: int


class CategoricalSchema(BaseModel):
    value_counts: list[CategoricalEntrySchema]
    missing_count: int
    total_count: int
    truncated: bool

    @classmethod
    def from_domain(cls, result: CategoricalResult) -> "CategoricalSchema":
        return cls(
            value_counts=[CategoricalEntrySchema(value=e.value, count=e.count) for e in result.value_counts],
            missing_count=result.missing_count,
            total_count=result.total_count,
            truncated=result.truncated,
        )


class KdePointSchema(BaseModel):
    x: float
    y: float


class KdeSchema(BaseModel):
    points: list[KdePointSchema]
    missing_count: int
    total_count: int

    @classmethod
    def from_domain(cls, result: KdeResult) -> "KdeSchema":
        return cls(
            points=[KdePointSchema(x=p.x, y=p.y) for p in result.points],
            missing_count=result.missing_count,
            total_count=result.total_count,
        )


class ViolinStatsSchema(BaseModel):
    min: float
    max: float
    q1: float
    median: float
    q3: float


class ViolinSchema(BaseModel):
    kde_points: list[KdePointSchema]
    stats: ViolinStatsSchema | None
    missing_count: int
    total_count: int

    @classmethod
    def from_domain(cls, result: ViolinResult) -> "ViolinSchema":
        stats = None
        if result.stats is not None:
            s = result.stats
            stats = ViolinStatsSchema(min=s.min, max=s.max, q1=s.q1, median=s.median, q3=s.q3)
        return cls(
            kde_points=[KdePointSchema(x=p.x, y=p.y) for p in result.kde_points],
            stats=stats,
            missing_count=result.missing_count,
            total_count=result.total_count,
        )
