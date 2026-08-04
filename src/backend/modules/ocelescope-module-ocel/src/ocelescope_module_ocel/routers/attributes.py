"""Aggregated and per-type attribute summaries (computation in ``util.attributes``)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query
from ocelescope_backend.app.dependencies import ApiOcel
from ocelescope_backend.app.internal.model.base import PaginatedResponse

from ocelescope_module_ocel.models import AggregatedAttribute, TypedAttribute
from ocelescope_module_ocel.util import attributes as attribute_util
from ocelescope_module_ocel.util.attributes import EntityType

router = APIRouter()


@router.get("/{ocel_id}/attributes", operation_id="AggregatedAttributes")
def get_aggr_attributes(
    ocel: ApiOcel,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query()] = 10,
    entity_type: Annotated[EntityType, Query()] = "events",
    attribute_names: Annotated[list[str] | None, Query()] = None,
    entity_names: Annotated[list[str] | None, Query()] = None,
    drop_constant: Annotated[bool, Query()] = False,
) -> PaginatedResponse[list[AggregatedAttribute]]:
    names = attribute_util.attribute_names(
        ocel, entity_type, attribute_names, entity_names, drop_constant
    )
    page_names = names[(page - 1) * page_size : page * page_size]

    return PaginatedResponse(
        page=page,
        page_size=page_size,
        total_items=len(names),
        response=attribute_util.aggregate_attributes(
            ocel, entity_type, page_names, entity_names
        ),
    )


@router.get(
    "/{ocel_id}/objects/attributes",
    response_model=list[TypedAttribute],
    operation_id="objectAttributes",
)
def get_object_attributes(
    ocel: ApiOcel,
    attribute_names: Annotated[list[str], Query()] = [],
    names: Annotated[list[str] | None, Query()] = None,
) -> list[TypedAttribute]:
    return attribute_util.typed_attributes(
        ocel, "objects", attribute_names or None, names
    )


@router.get(
    "/{ocel_id}/events/attributes",
    response_model=list[TypedAttribute],
    operation_id="eventAttributes",
)
def get_event_attributes(
    ocel: ApiOcel,
    attribute_names: Annotated[list[str], Query()] = [],
    names: Annotated[list[str] | None, Query()] = None,
) -> list[TypedAttribute]:
    return attribute_util.typed_attributes(
        ocel, "events", attribute_names or None, names
    )


@router.get("/{ocel_id}/attribute/names", operation_id="AttributeNames")
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
