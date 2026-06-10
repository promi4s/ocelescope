from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from ocelescope_module_exploration.application.use_cases.list_event_instances_use_case import (
    EventInstancesResult,
)
from ocelescope_module_exploration.domain.models import HistogramResult, Range


class AttributeInfoSchema(BaseModel):
    name: str
    type: Literal["numeric", "categorical"]


class RangeInput(BaseModel):
    """Request range. Either endpoint may be omitted for an open range."""

    min: float | None = None
    max: float | None = None

    @model_validator(mode="after")
    def _check_order(self) -> "RangeInput":
        if self.min is not None and self.max is not None and self.min > self.max:
            raise ValueError("range.min must be <= range.max")
        return self


class HistogramBody(BaseModel):
    range: RangeInput | None = None
    bins: int | None = Field(default=None, ge=1, le=500)


class RangeSchema(BaseModel):
    min: float
    max: float

    @classmethod
    def from_domain(cls, value: Range | None) -> "RangeSchema | None":
        if value is None:
            return None
        return cls(min=value.min, max=value.max)


class HistogramBinSchema(BaseModel):
    start: float
    end: float
    count: int


class HistogramCountsSchema(BaseModel):
    covered: int
    missing: int
    total: int


class HistogramSchema(BaseModel):
    bins: list[HistogramBinSchema]
    domain: RangeSchema | None
    covered: RangeSchema | None
    counts: HistogramCountsSchema

    @classmethod
    def from_domain(cls, result: HistogramResult) -> "HistogramSchema":
        return cls(
            bins=[
                HistogramBinSchema(start=b.start, end=b.end, count=b.count)
                for b in result.bins
            ],
            domain=RangeSchema.from_domain(result.domain),
            covered=RangeSchema.from_domain(result.covered),
            counts=HistogramCountsSchema(
                covered=result.counts.covered,
                missing=result.counts.missing,
                total=result.counts.total,
            ),
        )


class EventInstancesBody(BaseModel):
    range: RangeInput | None = None
    limit: int = Field(default=100, ge=1, le=500)


class EventInstanceSchema(BaseModel):
    id: str
    timestamp: datetime
    value: float | None


class EventInstancesSchema(BaseModel):
    instances: list[EventInstanceSchema]
    matching_count: int
    truncated: bool

    @classmethod
    def from_domain(cls, result: EventInstancesResult) -> "EventInstancesSchema":
        return cls(
            instances=[
                EventInstanceSchema(id=i.id, timestamp=i.timestamp, value=i.value)
                for i in result.instances
            ],
            matching_count=result.matching_count,
            truncated=result.truncated,
        )
