from typing import Annotated

from fastapi import APIRouter, Query
from ocelescope_backend.app.dependencies import ApiOcel

from ocelescope_module_ocelot.models import EntityTableColumn, PaginatedResponse
from ocelescope_module_ocelot.util import (
    get_activity_columns_def,
    get_object_columns_def,
    get_paginated_event_table,
    get_paginated_object_table,
)

router = APIRouter()


@router.get(
    "/{ocel_id}/events",
    response_model=PaginatedResponse,
    operation_id="paginatedEvents",
)
def get_events(
    ocel: ApiOcel,
    type: Annotated[str, Query(description="Activity name")],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 10,
    sort_by: Annotated[str | None, Query()] = None,
    ascending: Annotated[bool, Query()] = True,
):
    return get_paginated_event_table(
        ocel=ocel,
        activity=type,
        page_index=page,
        page_size=page_size,
        sort_by=sort_by,
        ascending=ascending,
    )


@router.get(
    "/{ocel_id}/objects",
    response_model=PaginatedResponse,
    operation_id="paginatedObjects",
)
def get_objects(
    ocel: ApiOcel,
    type: Annotated[str, Query(description="Object type name")],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 10,
    sort_by: Annotated[str | None, Query()] = None,
    ascending: Annotated[bool, Query()] = True,
):
    return get_paginated_object_table(
        ocel=ocel,
        object_type=type,
        page_index=page,
        page_size=page_size,
        sort_by=sort_by,
        ascending=ascending,
    )


@router.get("/{ocel_id}/objects/columns", operation_id="objectColumns")
def get_object_columns(ocel: ApiOcel, type_name: str) -> list[EntityTableColumn]:
    return get_object_columns_def(ocel, type_name)


@router.get("/{ocel_id}/events/columns", operation_id="activityColumns")
def get_activity_columns(ocel: ApiOcel, type_name: str) -> list[EntityTableColumn]:
    return get_activity_columns_def(ocel, type_name)
