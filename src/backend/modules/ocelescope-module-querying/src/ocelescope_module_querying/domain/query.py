from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal, TypeAlias

OcelSource = Literal["events", "objects", "e2o", "o2o", "object_changes"]
QueryDataType = Literal["number", "string", "boolean", "datetime", "unknown"]
QueryFieldRole = Literal[
    "id", "type", "timestamp", "qualifier", "attribute", "technical"
]
QueryScalar: TypeAlias = str | int | float | bool | datetime | None
FilterOperator = Literal[
    "eq",
    "neq",
    "in",
    "not_in",
    "lt",
    "lte",
    "gt",
    "gte",
    "between",
    "contains",
    "is_null",
    "not_null",
]
MeasureOperation = Literal[
    "count", "count_distinct", "sum", "avg", "min", "max", "median"
]
TimeUnit = Literal["minute", "hour", "day", "week", "month", "quarter", "year"]
SortDirection = Literal["asc", "desc"]


@dataclass(frozen=True)
class OcelField:
    name: str
    type: QueryDataType
    role: QueryFieldRole
    nullable: bool
    entity_types: list[str] = field(default_factory=list)
    types_by_entity: dict[str, QueryDataType] = field(default_factory=dict)


@dataclass(frozen=True)
class OcelSourceInfo:
    name: OcelSource
    row_count: int
    fields: list[OcelField]
    entity_types: list[str] = field(default_factory=list)
    id_field: str | None = None
    type_field: str | None = None
    timestamp_field: str | None = None


@dataclass(frozen=True)
class OcelSchema:
    sources: list[OcelSourceInfo]


@dataclass(frozen=True)
class QueryFilter:
    field: str
    operator: FilterOperator
    value: QueryScalar | list[QueryScalar] = None


@dataclass(frozen=True)
class NumericBin:
    count: int | None = None
    min: float | None = None
    max: float | None = None


@dataclass(frozen=True)
class QueryGroup:
    field: str
    alias: str
    bin: NumericBin | None = None
    time_unit: TimeUnit | None = None


@dataclass(frozen=True)
class QueryMeasure:
    operation: MeasureOperation
    alias: str
    field: str | None = None


@dataclass(frozen=True)
class QueryOrder:
    field: str
    direction: SortDirection = "asc"


@dataclass(frozen=True)
class OcelQuery:
    source: OcelSource
    fields: list[str]
    filters: list[QueryFilter]
    group_by: list[QueryGroup]
    measures: list[QueryMeasure]
    order_by: list[QueryOrder]
    limit: int


@dataclass(frozen=True)
class QueryColumn:
    name: str
    type: QueryDataType


@dataclass(frozen=True)
class QueryStats:
    source_rows: int
    filtered_rows: int
    matched_rows: int
    result_rows: int
    returned_rows: int
    truncated: bool


@dataclass(frozen=True)
class OcelQueryResult:
    columns: list[QueryColumn]
    rows: list[dict[str, QueryScalar]]
    stats: QueryStats


class InvalidOcelQuery(ValueError):
    pass
