"""Attribute summaries, value distributions and value counts (computation in ``util.attributes``)."""

from __future__ import annotations

from typing import Annotated, Literal

import duckdb
from fastapi import APIRouter, Depends, Query
from ocelescope_backend.app.dependencies import ApiOcel
from ocelescope_backend.app.internal.exceptions import BadRequest
from ocelescope_backend.app.internal.model.base import PaginatedResponse

from ocelescope_module_ocel.models import (
    AttributeStats,
    AttributeSummary,
    AttributeValues,
    Bin,
    SharedAttribute,
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


@router.get("/{ocel_id}/attributes/names", operation_id="attributeNames")
def get_attribute_names(
    ocel: ApiOcel,
    entity_type: Annotated[EntityType | None, Query()] = None,
) -> list[str]:
    names: list[str] = []
    if entity_type != "events":
        names += attribute_util.attribute_names(ocel, "objects")
    if entity_type != "objects":
        names += attribute_util.attribute_names(ocel, "events")
    return names


@router.get("/{ocel_id}/attributes/shared", operation_id="sharedAttributes")
def get_shared_attributes(
    ocel: ApiOcel,
    entity_type: Annotated[EntityType, Query()] = "events",
    entity_names: Annotated[list[str] | None, Query()] = None,
) -> list[SharedAttribute]:
    return attribute_util.shared_attributes(ocel, entity_type, entity_names)


ObjectValueKind = Literal["first", "initial", "last", "at"]


def _selector(kind: ObjectValueKind, at: str | None) -> ValueSelector:
    match kind:
        case "initial":
            return InitialValue()
        case "last":
            return LastValue()
        case "at":
            if at is None:
                raise BadRequest("object_value_at is required for object_value=at")
            return ValueAt(timestamp=at)
        case _:
            return FirstValue()


def _values(
    ocel: ApiOcel,
    attribute: Annotated[str, Query()],
    entity_type: Annotated[EntityType, Query()] = "events",
    entity_names: Annotated[list[str] | None, Query()] = None,
    object_value: Annotated[ObjectValueKind, Query()] = "first",
    object_value_at: Annotated[str | None, Query()] = None,
) -> AttributeRows | None:
    return attribute_util.attribute_values(
        ocel,
        entity_type,
        attribute,
        entity_names,
        _selector(object_value, object_value_at),
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
) -> AttributeValues:
    if selected is None:
        return AttributeValues(count=0, distinct_values=0, values=[])
    try:
        return attribute_util.attribute_counts(selected[0], regex, search, values)
    except duckdb.InvalidInputException as error:
        raise BadRequest(str(error)) from error
