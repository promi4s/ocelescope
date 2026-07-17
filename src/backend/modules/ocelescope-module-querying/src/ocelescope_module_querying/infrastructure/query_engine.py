"""Polars-backed execution of the declarative OCEL query DSL.

The public surface is intentionally small: :func:`describe_ocel` tells the
frontend which sources/fields exist and how they are typed, and
:func:`execute_query` runs a :class:`OcelQuery` against an in-memory ``OCEL``.

Row selection lives elsewhere: the query always runs against the OCEL the caller
hands in, which the API resolves to the user's *filtered* OCEL (from the
dedicated filter page). This module therefore only shapes the data — grouping and
aggregation are expressed as Polars expressions. Only the numeric histogram
binning drops down to NumPy, because it needs explicit bin edges (returned to the
frontend as ``<alias>_start`` / ``<alias>_end``) and must emit empty bins.
"""


import math
from datetime import datetime
from typing import cast

import numpy as np
import pandas as pd
import polars as pl
from ocelescope import OCEL
from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    E2O_QUALIFIER,
    EID_COL,
    OBJECT_CHANGE_CUMCOUNT,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)

from ocelescope_module_querying.domain.query import (
    InvalidOcelQuery,
    NumericBin,
    OcelField,
    OcelQuery,
    OcelQueryResult,
    OcelSchema,
    OcelSource,
    OcelSourceInfo,
    QueryColumn,
    QueryDataType,
    QueryFieldRole,
    QueryFilter,
    QueryMeasure,
    QueryScalar,
    QueryStats,
)

_MIN_AUTO_BINS = 5
_MAX_AUTO_BINS = 80

_SOURCE_FIELDS: dict[OcelSource, tuple[str | None, str | None, str | None]] = {
    "events": (EID_COL, ACTIVITY_COL, TIMESTAMP_COL),
    "objects": (OID_COL, OTYPE_COL, None),
    "e2o": (None, None, None),
    "o2o": (None, None, None),
    "object_changes": (OID_COL, OTYPE_COL, TIMESTAMP_COL),
}

# Polars calendar-aware truncation strings per requested time unit.
_TIME_UNIT_EVERY: dict[str, str] = {
    "minute": "1m",
    "hour": "1h",
    "day": "1d",
    "week": "1w",
    "month": "1mo",
    "quarter": "3mo",
    "year": "1y",
}


# --------------------------------------------------------------------------- #
# Source materialisation                                                       #
# --------------------------------------------------------------------------- #
def _pandas_source(ocel: OCEL, source: OcelSource) -> pd.DataFrame:
    if source == "events":
        return ocel.events.df
    if source == "objects":
        return ocel.objects.df
    if source == "e2o":
        return ocel.e2o.df
    if source == "o2o":
        return ocel.o2o.typed_df
    return ocel.objects.changes


def source_frame(ocel: OCEL, source: OcelSource) -> pl.DataFrame:
    """Return the requested OCEL source as a Polars frame without ``@@`` internals."""
    frame = _pandas_source(ocel, source)
    visible = [column for column in frame.columns if not str(column).startswith("@@")]
    return pl.from_pandas(frame.loc[:, visible])


# --------------------------------------------------------------------------- #
# Typing / schema introspection                                               #
# --------------------------------------------------------------------------- #
def _data_type(dtype: pl.DataType) -> QueryDataType:
    if dtype.is_temporal():
        return "datetime"
    if dtype == pl.Boolean:
        return "boolean"
    if dtype.is_numeric():
        return "number"
    if dtype == pl.Null:
        return "unknown"
    return "string"


def _field_role(
    field: str, id_field: str | None, type_field: str | None
) -> QueryFieldRole:
    if field == id_field or field in {EID_COL, OID_COL, "ocel:oid_1", "ocel:oid_2"}:
        return "id"
    if field == type_field or field in {
        ACTIVITY_COL,
        OTYPE_COL,
        "ocel:type_1",
        "ocel:type_2",
    }:
        return "type"
    if field == TIMESTAMP_COL:
        return "timestamp"
    if field == E2O_QUALIFIER:
        return "qualifier"
    if field == OBJECT_CHANGE_CUMCOUNT or field.startswith("ocel:"):
        return "technical"
    return "attribute"


def describe_ocel(ocel: OCEL) -> OcelSchema:
    sources: list[OcelSourceInfo] = []
    for source, (id_field, type_field, timestamp_field) in _SOURCE_FIELDS.items():
        frame = source_frame(ocel, source)
        typed = type_field is not None and type_field in frame.columns

        entity_types = (
            frame.get_column(type_field).drop_nulls().unique().sort().to_list()
            if typed
            else []
        )
        entity_types = [str(value) for value in entity_types]

        fields: list[OcelField] = []
        for name, dtype in frame.schema.items():
            data_type = _data_type(dtype)
            available_for = (
                [
                    str(value)
                    for value in frame.filter(pl.col(name).is_not_null())
                    .get_column(type_field)
                    .drop_nulls()
                    .unique()
                    .sort()
                    .to_list()
                ]
                if typed
                else []
            )
            fields.append(
                OcelField(
                    name=str(name),
                    type=data_type,
                    role=_field_role(str(name), id_field, type_field),
                    nullable=frame.get_column(name).null_count() > 0,
                    entity_types=available_for,
                    types_by_entity={
                        entity_type: data_type for entity_type in available_for
                    },
                )
            )

        sources.append(
            OcelSourceInfo(
                name=source,
                row_count=frame.height,
                fields=fields,
                entity_types=entity_types,
                id_field=id_field,
                type_field=type_field,
                timestamp_field=timestamp_field,
            )
        )
    return OcelSchema(sources=sources)


# --------------------------------------------------------------------------- #
# Filtering                                                                    #
# --------------------------------------------------------------------------- #
def _is_number(value: QueryScalar) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _literal(dtype: pl.DataType, value: QueryScalar) -> pl.Expr:
    """Build a comparison literal that lines up with a typed column."""
    if isinstance(value, datetime) and isinstance(dtype, pl.Datetime):
        lit = pl.lit(value)
        if dtype.time_zone is not None:
            lit = (
                lit.dt.replace_time_zone(dtype.time_zone)
                if value.tzinfo is None
                else lit.dt.convert_time_zone(dtype.time_zone)
            )
        return lit.cast(dtype, strict=False)
    return pl.lit(value)


def _comparison_column(field: str, dtype: pl.DataType, value: QueryScalar) -> pl.Expr:
    """Numeric comparisons coerce the column so string columns stay comparable."""
    if _is_number(value) and not dtype.is_numeric():
        return pl.col(field).cast(pl.Float64, strict=False)
    return pl.col(field)


def _filter_expr(schema: dict[str, pl.DataType], query_filter: QueryFilter) -> pl.Expr:
    field = query_filter.field
    dtype = schema[field]
    operator = query_filter.operator
    value = query_filter.value
    column = pl.col(field)

    if operator == "is_null":
        return column.is_null()
    if operator == "not_null":
        return column.is_not_null()

    if operator in {"in", "not_in"}:
        if not isinstance(value, list):
            raise InvalidOcelQuery(f"Filter '{operator}' requires a list value")
        mask = column.is_in(value).fill_null(False)
        return ~mask if operator == "not_in" else mask

    if operator == "between":
        if not isinstance(value, list) or len(value) != 2:
            raise InvalidOcelQuery("Filter 'between' requires exactly two values")
        lower, upper = value
        comparable = _comparison_column(field, dtype, lower)
        return (
            comparable.ge(_literal(dtype, lower)) & comparable.le(_literal(dtype, upper))
        ).fill_null(False)

    if isinstance(value, list) or value is None:
        raise InvalidOcelQuery(f"Filter '{operator}' requires a scalar value")

    if operator == "contains":
        needle = str(value).lower()
        return (
            column.cast(pl.String)
            .str.to_lowercase()
            .str.contains(needle, literal=True)
            .fill_null(False)
        )

    if operator in {"lt", "lte", "gt", "gte"}:
        comparable = _comparison_column(field, dtype, value)
        literal = _literal(dtype, value)
        expr = {
            "lt": comparable.lt,
            "lte": comparable.le,
            "gt": comparable.gt,
            "gte": comparable.ge,
        }[operator](literal)
        return expr.fill_null(False)

    mask = column.eq(_literal(dtype, value)).fill_null(False)
    return ~mask if operator == "neq" else mask


def _apply_filters(frame: pl.DataFrame, filters: list[QueryFilter]) -> pl.DataFrame:
    if not filters:
        return frame
    schema = dict(frame.schema)
    predicate = pl.all_horizontal(
        [_filter_expr(schema, query_filter) for query_filter in filters]
    )
    return frame.filter(predicate)


# --------------------------------------------------------------------------- #
# Aggregation                                                                  #
# --------------------------------------------------------------------------- #
def _auto_bin_count(values: np.ndarray, span: float) -> int:
    count = len(values)
    if count < 2 or span <= 0:
        return 1
    q1, q3 = np.percentile(values, [25, 75])
    iqr = float(q3 - q1)
    if iqr > 0:
        width = 2 * iqr * count ** (-1 / 3)
        bins = max(1, math.ceil(span / width))
    else:
        bins = max(1, math.ceil(math.sqrt(count)))
    return max(_MIN_AUTO_BINS, min(_MAX_AUTO_BINS, bins))


def _bin_indices(
    values: np.ndarray, numeric_bin: NumericBin
) -> tuple[list[int | None], np.ndarray]:
    """Assign each value to a bin index (``None`` when out of range) plus edges."""
    numeric = values.astype(float)
    finite = np.isfinite(numeric)
    valid = numeric[finite]
    if numeric_bin.min is not None:
        valid = valid[valid >= numeric_bin.min]
    if numeric_bin.max is not None:
        valid = valid[valid <= numeric_bin.max]

    if valid.size == 0:
        return [None] * len(numeric), np.array([], dtype=float)

    minimum = float(numeric_bin.min if numeric_bin.min is not None else valid.min())
    maximum = float(numeric_bin.max if numeric_bin.max is not None else valid.max())
    span = maximum - minimum

    if span == 0:
        edges = np.array([minimum, maximum], dtype=float)
        indices = [
            0 if is_finite and value == minimum else None
            for value, is_finite in zip(numeric, finite)
        ]
        return indices, edges

    bin_count = numeric_bin.count or _auto_bin_count(valid, span)
    edges = np.linspace(minimum, maximum, bin_count + 1)
    raw = np.searchsorted(edges, numeric, side="right") - 1
    raw = np.where(numeric == maximum, bin_count - 1, raw)
    valid_mask = finite & (numeric >= minimum) & (numeric <= maximum)
    indices = [
        int(index) if keep else None for index, keep in zip(raw, valid_mask)
    ]
    return indices, edges


def _measure_expr(measure: QueryMeasure) -> pl.Expr:
    operation = measure.operation
    if operation == "count":
        base = pl.len() if measure.field is None else pl.col(measure.field).count()
        return base.alias(measure.alias)

    assert measure.field is not None
    column = pl.col(measure.field)
    if operation == "count_distinct":
        return column.drop_nulls().n_unique().alias(measure.alias)
    if operation in {"sum", "avg", "median"}:
        numeric = column.cast(pl.Float64, strict=False)
        expr = {
            "sum": numeric.sum,
            "avg": numeric.mean,
            "median": numeric.median,
        }[operation]()
        return expr.alias(measure.alias)
    return getattr(column, operation)().alias(measure.alias)


def _aggregate_query(
    frame: pl.DataFrame, query: OcelQuery
) -> tuple[pl.DataFrame, int]:
    working = frame
    group_columns: list[str] = []
    # (internal column, output alias, bin edges or None for non-binned groups)
    output_groups: list[tuple[str, str, np.ndarray | None]] = []

    for index, group in enumerate(query.group_by):
        internal = f"__group_{index}"
        if group.bin:
            values = working.get_column(group.field).cast(pl.Float64, strict=False)
            indices, edges = _bin_indices(values.to_numpy(), group.bin)
            working = working.with_columns(
                pl.Series(internal, indices, dtype=pl.Int64)
            )
            output_groups.append((internal, group.alias, edges))
        elif group.time_unit:
            every = _TIME_UNIT_EVERY[group.time_unit]
            working = working.with_columns(
                pl.col(group.field).dt.truncate(every).alias(internal)
            )
            output_groups.append((internal, group.alias, None))
        else:
            working = working.with_columns(pl.col(group.field).alias(internal))
            output_groups.append((internal, group.alias, None))
        group_columns.append(internal)

    if group_columns:
        working = working.drop_nulls(subset=group_columns)
    matched_rows = working.height

    if group_columns:
        if query.measures:
            result = working.group_by(group_columns).agg(
                [_measure_expr(measure) for measure in query.measures]
            )
        else:
            result = working.select(group_columns).unique()
    else:
        result = working.select(
            [_measure_expr(measure) for measure in query.measures]
        )

    # A single binned dimension reports empty bins as zero-count rows.
    if len(output_groups) == 1:
        internal, _, edges = output_groups[0]
        if edges is not None and len(edges) >= 2:
            scaffold = pl.DataFrame(
                {internal: pl.arange(0, len(edges) - 1, eager=True).cast(pl.Int64)}
            )
            result = scaffold.join(result, on=internal, how="left")
            zero_fill = [
                pl.col(measure.alias).fill_null(0)
                for measure in query.measures
                if measure.operation in {"count", "count_distinct"}
            ]
            if zero_fill:
                result = result.with_columns(zero_fill)

    result = _expand_groups(result, output_groups)
    return result, matched_rows


def _expand_groups(
    result: pl.DataFrame, output_groups: list[tuple[str, str, np.ndarray | None]]
) -> pl.DataFrame:
    for internal, alias, edges in output_groups:
        if edges is None:
            result = result.rename({internal: alias})
            continue
        if len(edges) == 0:
            result = result.drop(internal).with_columns(
                pl.lit(None, dtype=pl.Float64).alias(alias),
                pl.lit(None, dtype=pl.Float64).alias(f"{alias}_start"),
                pl.lit(None, dtype=pl.Float64).alias(f"{alias}_end"),
            )
            continue
        starts = result.get_column(internal).map_elements(
            lambda index: float(edges[index]), return_dtype=pl.Float64
        )
        ends = result.get_column(internal).map_elements(
            lambda index: float(edges[index + 1]), return_dtype=pl.Float64
        )
        result = result.drop(internal).with_columns(
            ((starts + ends) / 2).alias(alias),
            starts.alias(f"{alias}_start"),
            ends.alias(f"{alias}_end"),
        )
    return result


# --------------------------------------------------------------------------- #
# Result assembly                                                              #
# --------------------------------------------------------------------------- #
def _require_fields(frame: pl.DataFrame, fields: list[str]) -> None:
    missing = sorted(set(fields) - set(frame.columns))
    if missing:
        raise InvalidOcelQuery(f"Unknown field(s): {', '.join(missing)}")


def _result_columns(frame: pl.DataFrame) -> list[QueryColumn]:
    return [
        QueryColumn(name=str(name), type=_data_type(dtype))
        for name, dtype in frame.schema.items()
    ]


def _json_scalar(value: object) -> QueryScalar:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    return cast(QueryScalar, value)


def _order_result(result: pl.DataFrame, query: OcelQuery) -> pl.DataFrame:
    if not query.order_by:
        return result
    available = set(result.columns)
    for order in query.order_by:
        if order.field not in available:
            raise InvalidOcelQuery(
                f"Cannot sort by unknown result field '{order.field}'"
            )
    return result.sort(
        by=[order.field for order in query.order_by],
        descending=[order.direction == "desc" for order in query.order_by],
        nulls_last=True,
        maintain_order=True,
    )


def execute_query(ocel: OCEL, query: OcelQuery) -> OcelQueryResult:
    source = source_frame(ocel, query.source)
    referenced_fields = [
        *query.fields,
        *(item.field for item in query.filters),
        *(item.field for item in query.group_by),
        *(item.field for item in query.measures if item.field),
    ]
    _require_fields(source, referenced_fields)

    filtered = _apply_filters(source, query.filters)
    if query.group_by or query.measures:
        result, matched_rows = _aggregate_query(filtered, query)
    else:
        result = filtered.select(query.fields)
        matched_rows = result.height

    result = _order_result(result, query)

    result_rows = result.height
    returned = result.head(query.limit)
    rows = [
        {str(key): _json_scalar(value) for key, value in row.items()}
        for row in returned.to_dicts()
    ]
    return OcelQueryResult(
        columns=_result_columns(returned),
        rows=rows,
        stats=QueryStats(
            source_rows=source.height,
            filtered_rows=filtered.height,
            matched_rows=matched_rows,
            result_rows=result_rows,
            returned_rows=returned.height,
            truncated=result_rows > returned.height,
        ),
    )
