"""Attribute summaries, value distributions and value counts (computation in ``util.attributes``)."""

from __future__ import annotations

from typing import Annotated, Literal

import duckdb
from fastapi import APIRouter, Depends, Query
from ocelescope_backend.app.dependencies import ApiOcel
from ocelescope_backend.app.internal.exceptions import BadRequest
from ocelescope_backend.app.internal.model.base import PaginatedResponse

from ocelescope import OCEL
from ocelescope_module_ocel.models import (
    AttributeInfo,
    AttributeStats,
    AttributeSummary,
    AttributeValues,
    Bin,
    TypedAttribute,
)
from ocelescope_module_ocel.util import attributes as attribute_util
from ocelescope_module_ocel.util.attributes import AttributeRows, EntityType
from ocelescope_module_ocel.util.selectors import (
    FirstValue,
    InitialValue,
    LastValue,
    ValueAt,
    ValueSelector,
)

router = APIRouter()


@router.get("/{ocel_id}/attributes/stats", operation_id="attributeStats")
def get_attribute_stats(
    ocel: ApiOcel,
    entity_type: Annotated[EntityType, Query()] = "events",
    attribute_names: Annotated[list[str] | None, Query()] = None,
    entity_names: Annotated[list[str] | None, Query()] = None,
    drop_constant: Annotated[bool, Query()] = False,
    per_type: Annotated[bool, Query()] = False,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int | None, Query(ge=1)] = None,
) -> PaginatedResponse[list[AttributeStats]]:
    names = attribute_util.attribute_names(
        ocel, entity_type, attribute_names, entity_names, drop_constant
    )
    shown = names[(page - 1) * page_size : page * page_size] if page_size else names
    return PaginatedResponse(
        page=page,
        page_size=page_size or max(len(names), 1),
        total_items=len(names),
        response=attribute_util.attribute_stats(
            ocel, entity_type, shown, entity_names, per_type
        ),
    )


@router.get("/{ocel_id}/attributes", operation_id="attributes")
def get_attributes(
    ocel: ApiOcel,
    entity_type: Annotated[EntityType, Query()] = "events",
    entity_names: Annotated[list[str] | None, Query()] = None,
) -> list[AttributeInfo]:
    return attribute_util.list_attributes(ocel, entity_type, entity_names)


def _typed(
    ocel: OCEL,
    entity_type: EntityType,
    attribute_names: list[str],
    names: list[str] | None,
) -> list[TypedAttribute]:
    return [
        TypedAttribute(
            name=stats.name,
            min=stats.min,
            max=stats.max,
            distinct_values=stats.distinct_values,
            type=stats.type,
            entity_type=stats.entity_types[0],
        )
        for stats in attribute_util.attribute_stats(
            ocel, entity_type, attribute_names or None, names, per_type=True
        )
    ]


@router.get(
    "/{ocel_id}/events/attributes",
    operation_id="eventAttributes",
    deprecated=True,
)
def get_event_attributes(
    ocel: ApiOcel,
    attribute_names: Annotated[list[str], Query(default_factory=list)],
    names: Annotated[list[str] | None, Query()] = None,
) -> list[TypedAttribute]:
    return _typed(ocel, "events", attribute_names, names)


@router.get(
    "/{ocel_id}/objects/attributes",
    operation_id="objectAttributes",
    deprecated=True,
)
def get_object_attributes(
    ocel: ApiOcel,
    attribute_names: Annotated[list[str], Query(default_factory=list)],
    names: Annotated[list[str] | None, Query()] = None,
) -> list[TypedAttribute]:
    return _typed(ocel, "objects", attribute_names, names)


@router.get("/{ocel_id}/attributes/names", operation_id="attributeNames")
def get_attribute_names(
    ocel: ApiOcel,
    entity_type: Annotated[EntityType, Query()] = "events",
) -> list[str]:
    return sorted(attribute_util.attribute_types(ocel, entity_type))


ObjectValueKind = Literal["first", "initial", "last", "at"]


def _values(
    ocel: ApiOcel,
    attribute: Annotated[str, Query()],
    entity_type: Annotated[EntityType, Query()] = "events",
    entity_names: Annotated[list[str] | None, Query()] = None,
    object_value: Annotated[ObjectValueKind, Query()] = "first",
    object_value_at: Annotated[str | None, Query()] = None,
) -> AttributeRows | None:
    selector: ValueSelector
    match object_value:
        case "initial":
            selector = InitialValue()
        case "last":
            selector = LastValue()
        case "at":
            if object_value_at is None:
                raise BadRequest("object_value_at is required for object_value=at")
            selector = ValueAt(timestamp=object_value_at)
        case _:
            selector = FirstValue()
    return attribute_util.attribute_values(
        ocel, entity_type, attribute, entity_names, selector
    )


Values = Annotated[AttributeRows | None, Depends(_values)]


@router.get("/{ocel_id}/attributes/summary", operation_id="attributeSummary")
def get_attribute_summary(
    ocel: ApiOcel,
    selected: Values,
    attribute: Annotated[str, Query()],
    entity_type: Annotated[EntityType, Query()] = "events",
    entity_names: Annotated[list[str] | None, Query()] = None,
) -> AttributeSummary | None:
    if selected is None:
        return None
    dynamic = entity_type == "objects" and attribute_util.is_dynamic(
        ocel, attribute, entity_names
    )
    return attribute_util.attribute_summary(*selected, dynamic)


@router.get("/{ocel_id}/attributes/bins", operation_id="attributeBins")
def get_attribute_bins(
    selected: Values,
    bins: Annotated[int, Query(ge=1, le=500)] = 40,
) -> list[Bin]:
    return attribute_util.attribute_bins(*selected, bins) if selected else []


@router.get("/{ocel_id}/attributes/values", operation_id="attributeValues")
def get_attribute_values(
    selected: Values,
    regex: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
    values: Annotated[list[str] | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=10_000)] = 200,
) -> AttributeValues:
    if selected is None:
        return AttributeValues(count=0, distinct_values=0, values=[])
    try:
        return attribute_util.attribute_counts(
            selected[0], regex, search, values, limit
        )
    except duckdb.InvalidInputException as error:
        raise BadRequest(str(error)) from error
