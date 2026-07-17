from datetime import datetime
from typing import Literal, TypeAlias

from pydantic import BaseModel, Field, model_validator

from ocelescope_module_querying.domain.query import (
    NumericBin,
    OcelQuery,
    OcelQueryResult,
    OcelSchema,
    QueryFilter,
    QueryGroup,
    QueryMeasure,
    QueryOrder,
)

QueryValue: TypeAlias = str | int | float | bool | datetime | None


class OcelFieldSchema(BaseModel):
    name: str
    type: Literal["number", "string", "boolean", "datetime", "unknown"]
    role: Literal["id", "type", "timestamp", "qualifier", "attribute", "technical"]
    nullable: bool
    entity_types: list[str]
    types_by_entity: dict[
        str, Literal["number", "string", "boolean", "datetime", "unknown"]
    ]


class OcelSourceSchema(BaseModel):
    name: Literal["events", "objects", "e2o", "o2o", "object_changes"]
    row_count: int
    fields: list[OcelFieldSchema]
    entity_types: list[str]
    id_field: str | None
    type_field: str | None
    timestamp_field: str | None


class OcelSchemaResponse(BaseModel):
    sources: list[OcelSourceSchema]

    @classmethod
    def from_domain(cls, schema: OcelSchema) -> "OcelSchemaResponse":
        return cls(
            sources=[
                OcelSourceSchema(
                    name=source.name,
                    row_count=source.row_count,
                    fields=[
                        OcelFieldSchema(
                            name=field.name,
                            type=field.type,
                            role=field.role,
                            nullable=field.nullable,
                            entity_types=field.entity_types,
                            types_by_entity=field.types_by_entity,
                        )
                        for field in source.fields
                    ],
                    entity_types=source.entity_types,
                    id_field=source.id_field,
                    type_field=source.type_field,
                    timestamp_field=source.timestamp_field,
                )
                for source in schema.sources
            ]
        )


class QueryFilterSchema(BaseModel):
    field: str
    operator: Literal[
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
    value: QueryValue | list[QueryValue] = None

    @model_validator(mode="after")
    def _check_value(self) -> "QueryFilterSchema":
        if self.operator in {"is_null", "not_null"}:
            if self.value is not None:
                raise ValueError(f"filter '{self.operator}' does not accept a value")
        elif self.operator in {"in", "not_in"}:
            if not isinstance(self.value, list):
                raise ValueError(f"filter '{self.operator}' requires a list value")
        elif self.operator == "between":
            if not isinstance(self.value, list) or len(self.value) != 2:
                raise ValueError("filter 'between' requires exactly two values")
        elif self.value is None or isinstance(self.value, list):
            raise ValueError(f"filter '{self.operator}' requires a scalar value")
        return self

    def to_domain(self) -> QueryFilter:
        return QueryFilter(field=self.field, operator=self.operator, value=self.value)


class NumericBinSchema(BaseModel):
    count: int | None = Field(default=None, ge=1, le=500)
    min: float | None = None
    max: float | None = None

    @model_validator(mode="after")
    def _check_order(self) -> "NumericBinSchema":
        if self.min is not None and self.max is not None and self.min > self.max:
            raise ValueError("bin.min must be <= bin.max")
        return self

    def to_domain(self) -> NumericBin:
        return NumericBin(count=self.count, min=self.min, max=self.max)


class QueryGroupSchema(BaseModel):
    field: str
    alias: str = Field(pattern=r"^[A-Za-z_][A-Za-z0-9_]*$")
    bin: NumericBinSchema | None = None
    time_unit: (
        Literal["minute", "hour", "day", "week", "month", "quarter", "year"] | None
    ) = None

    @model_validator(mode="after")
    def _check_transform(self) -> "QueryGroupSchema":
        if self.bin is not None and self.time_unit is not None:
            raise ValueError("a group cannot use both bin and time_unit")
        return self

    def to_domain(self) -> QueryGroup:
        return QueryGroup(
            field=self.field,
            alias=self.alias,
            bin=self.bin.to_domain() if self.bin else None,
            time_unit=self.time_unit,
        )


class QueryMeasureSchema(BaseModel):
    operation: Literal["count", "count_distinct", "sum", "avg", "min", "max", "median"]
    alias: str = Field(pattern=r"^[A-Za-z_][A-Za-z0-9_]*$")
    field: str | None = None

    @model_validator(mode="after")
    def _check_field(self) -> "QueryMeasureSchema":
        if self.operation != "count" and self.field is None:
            raise ValueError(f"measure '{self.operation}' requires a field")
        return self

    def to_domain(self) -> QueryMeasure:
        return QueryMeasure(
            operation=self.operation, alias=self.alias, field=self.field
        )


class QueryOrderSchema(BaseModel):
    field: str
    direction: Literal["asc", "desc"] = "asc"

    def to_domain(self) -> QueryOrder:
        return QueryOrder(field=self.field, direction=self.direction)


class OcelQueryBody(BaseModel):
    source: Literal["events", "objects", "e2o", "o2o", "object_changes"]
    fields: list[str] = Field(default_factory=list, max_length=50)
    filters: list[QueryFilterSchema] = Field(default_factory=list, max_length=20)
    group_by: list[QueryGroupSchema] = Field(default_factory=list, max_length=3)
    measures: list[QueryMeasureSchema] = Field(default_factory=list, max_length=10)
    order_by: list[QueryOrderSchema] = Field(default_factory=list, max_length=5)
    limit: int = Field(default=1000, ge=1, le=5000)

    @model_validator(mode="after")
    def _check_shape(self) -> "OcelQueryBody":
        aggregate = bool(self.group_by or self.measures)
        if aggregate and self.fields:
            raise ValueError("fields cannot be combined with group_by or measures")
        if not aggregate and not self.fields:
            raise ValueError("a row query requires at least one field")

        aliases = [group.alias for group in self.group_by] + [
            measure.alias for measure in self.measures
        ]
        derived_aliases = [
            name
            for group in self.group_by
            if group.bin is not None
            for name in (f"{group.alias}_start", f"{group.alias}_end")
        ]
        if len(set([*aliases, *derived_aliases])) != len(aliases) + len(
            derived_aliases
        ):
            raise ValueError("query result aliases must be unique")
        return self

    def to_domain(self) -> OcelQuery:
        return OcelQuery(
            source=self.source,
            fields=self.fields,
            filters=[item.to_domain() for item in self.filters],
            group_by=[item.to_domain() for item in self.group_by],
            measures=[item.to_domain() for item in self.measures],
            order_by=[item.to_domain() for item in self.order_by],
            limit=self.limit,
        )


class QueryColumnSchema(BaseModel):
    name: str
    type: Literal["number", "string", "boolean", "datetime", "unknown"]


class QueryStatsSchema(BaseModel):
    source_rows: int
    filtered_rows: int
    matched_rows: int
    result_rows: int
    returned_rows: int
    truncated: bool


class OcelQueryResponse(BaseModel):
    columns: list[QueryColumnSchema]
    rows: list[dict[str, QueryValue]]
    stats: QueryStatsSchema

    @classmethod
    def from_domain(cls, result: OcelQueryResult) -> "OcelQueryResponse":
        return cls(
            columns=[
                QueryColumnSchema(name=column.name, type=column.type)
                for column in result.columns
            ],
            rows=result.rows,
            stats=QueryStatsSchema(
                source_rows=result.stats.source_rows,
                filtered_rows=result.stats.filtered_rows,
                matched_rows=result.stats.matched_rows,
                result_rows=result.stats.result_rows,
                returned_rows=result.stats.returned_rows,
                truncated=result.stats.truncated,
            ),
        )
