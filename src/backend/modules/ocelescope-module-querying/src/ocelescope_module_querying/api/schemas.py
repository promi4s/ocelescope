from typing import Annotated, Literal

from pydantic import BaseModel, Field

AttributeDataType = Literal["number", "string", "boolean", "datetime", "unknown"]
AttributeScope = Literal["event", "object"]
AnalyticalType = Literal["categorical", "discrete", "continuous", "temporal", "unknown"]


class AttributeSchemaItem(BaseModel):
    name: str
    physical_type: AttributeDataType
    inferred_analytical_type: AnalyticalType
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


class AttributeClassificationOverride(BaseModel):
    scope: AttributeScope
    entity_type: str
    attribute: str
    analytical_type: AnalyticalType


class UpdateAnalyticalSchemaRequest(BaseModel):
    overrides: list[AttributeClassificationOverride]


class CategoryGrouping(BaseModel):
    kind: Literal["categories"]
    limit: int = Field(default=50, ge=1, le=500)


class NumericBinGrouping(BaseModel):
    kind: Literal["bins"]
    count: int | None = Field(default=None, ge=1, le=200)


DistributionGrouping = Annotated[
    CategoryGrouping | NumericBinGrouping, Field(discriminator="kind")
]


class EventAttributeDistributionQuery(BaseModel):
    activity: str
    attribute: str
    grouping: DistributionGrouping


class ObjectAttributeDistributionQuery(BaseModel):
    activity: str
    object_type: str
    attribute: str
    grouping: DistributionGrouping


class ActivityObjectTypePair(BaseModel):
    activity: str
    object_type: str


class ObjectAttributeDistributionOptionsResponse(BaseModel):
    pairs: list[ActivityObjectTypePair]


class ObjectCountsPerEventQuery(BaseModel):
    activities: list[str] = Field(default_factory=list)


class ObjectCountPerEventRow(BaseModel):
    activity: str
    object_type: str
    object_count: int
    event_count: int


class ActivityEventCount(BaseModel):
    activity: str
    event_count: int


class ObjectCountsPerEventResponse(BaseModel):
    rows: list[ObjectCountPerEventRow]
    activity_event_counts: list[ActivityEventCount]


class ObjectTypeCombinationsQuery(BaseModel):
    limit: int = Field(default=15, ge=1, le=50)
    activities: list[str] = Field(default_factory=list)


class ObjectTypeCombinationRow(BaseModel):
    object_types: list[str]
    activity: str
    event_count: int


class ObjectTypeCombinationsResponse(BaseModel):
    rows: list[ObjectTypeCombinationRow]
    total_event_count: int
    represented_event_count: int
    total_combination_count: int
    truncated: bool


class ActivityExecutionFrequencyQuery(BaseModel):
    object_type: str


class ActivityExecutionFrequencyRow(BaseModel):
    activity: str
    lower_bound: int
    upper_bound: int | None
    label: str
    object_count: int


class ActivityExecutionFrequencyResponse(BaseModel):
    rows: list[ActivityExecutionFrequencyRow]
    object_activity_pair_count: int
    object_count: int
    maximum_execution_count: int


class ObjectActivityExecutionDistributionQuery(BaseModel):
    object_type: str


class ObjectActivityExecutionDistributionRow(BaseModel):
    activity: str
    execution_count: int
    object_count: int


class ObjectActivityExecutionDistributionResponse(BaseModel):
    rows: list[ObjectActivityExecutionDistributionRow]
    contributing_object_count: int
    activity_count: int


class TotalObjectInvolvementRow(BaseModel):
    activity: str
    object_count: int
    event_count: int


class TotalObjectInvolvementResponse(BaseModel):
    rows: list[TotalObjectInvolvementRow]
    event_count: int


class ObjectInvolvementDistributionQuery(BaseModel):
    activity: str
    object_type: str
    grouping: DistributionGrouping


class ObjectInvolvementOption(BaseModel):
    activity: str
    object_type: str
    minimum: int
    maximum: int


class ObjectInvolvementOptionsResponse(BaseModel):
    pairs: list[ObjectInvolvementOption]


TimeUnit = Literal["seconds", "minutes", "hours", "days"]


class TimeBetweenActivitiesQuery(BaseModel):
    source_activity: str
    target_activity: str
    object_type: str
    unit: TimeUnit
    bin_count: int = Field(default=20, ge=1, le=200)


class TimeBetweenActivitiesResponse(BaseModel):
    buckets: list["DistributionBucket"]
    counts: "QueryCounts"
    truncated: bool
    unit: TimeUnit
    pair_count: int
    contributing_object_count: int


class DistributionBucket(BaseModel):
    key: str
    label: str
    count: int
    kind: Literal["value", "range", "missing", "other"]
    value: str | int | float | bool | None = None
    lower: float | None = None
    upper: float | None = None
    inclusive_upper: bool = False


class QueryCounts(BaseModel):
    total: int
    present: int
    missing: int
    represented: int


class DistributionResponse(BaseModel):
    buckets: list[DistributionBucket]
    counts: QueryCounts
    truncated: bool
