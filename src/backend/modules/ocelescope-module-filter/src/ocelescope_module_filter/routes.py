import json
import time
from typing import Annotated, Literal

import duckdb
from fastapi import APIRouter, Body, Query
from ocelescope.ocel.view import Clean
from ocelescope_backend.app.dependencies import ApiOcel, ApiSession
from ocelescope_backend.app.internal.exceptions import BadRequest
from ocelescope_backend.app.internal.model.ocel import SessionOCEL
from ocelescope_backend.app.internal.model.view import SessionView
from ocelescope_backend.app.sse_manager import SystemNotification, sse_manager
from ocelescope_module_ocel.util.attributes import EntityType

from ocelescope_module_filter.filters import FILTER_SOURCE, NativeFilter
from ocelescope_module_filter.filters.attribute.selectors import (
    FirstValue,
    InitialValue,
    LastValue,
    ValueAt,
    ValueSelector,
)
from ocelescope_module_filter.state import (
    ApiFilterState,
    FilterModuleState,
    FilterState,
)
from ocelescope_module_filter.util.attributes import (
    AttributeBin,
    AttributeSummary,
    AttributeValues,
    SharedAttribute,
    event_attribute_bins,
    event_attribute_summary,
    event_attribute_values,
    object_attribute_bins,
    object_attribute_summary,
    object_attribute_values,
    shared_attributes,
)

router = APIRouter()

DEFAULT_VIEW_NAME = "Filtered"


def pipeline_key(pipeline: list[NativeFilter]) -> str:
    return json.dumps(
        [step.model_dump(mode="json") for step in pipeline], sort_keys=True
    )


def create_filter_view(
    handle: SessionOCEL,
    pipeline: list[NativeFilter],
    name: str,
    temporary: bool = False,
) -> SessionView:
    return handle.create_view(
        [*pipeline, Clean()],
        FILTER_SOURCE,
        pipeline_key(pipeline),
        name=name,
        temporary=temporary,
    )


@router.post("/{ocel_id}/views", operation_id="registerView")
def register_view(
    ocel_id: str,
    session: ApiSession,
    steps: Annotated[list[NativeFilter], Body()],
    name: str | None = None,
) -> str | None:
    if not steps:
        return None
    return create_filter_view(
        session.get_ocel(ocel_id),
        steps,
        name=name or "Filter preview",
        temporary=name is None,
    ).id


@router.get("/{ocel_id}/attributes/shared", operation_id="getSharedAttributes")
def get_shared_attributes(
    ocel: ApiOcel,
    entity_type: Annotated[EntityType, Query()] = "events",
    entity_names: Annotated[list[str] | None, Query()] = None,
) -> list[SharedAttribute]:
    return shared_attributes(ocel, entity_type, entity_names)


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


@router.get(
    "/{ocel_id}/events/attributes/summary", operation_id="getEventAttributeSummary"
)
def get_event_attribute_summary(
    ocel: ApiOcel,
    attribute: Annotated[str, Query()],
    entity_names: Annotated[list[str] | None, Query()] = None,
) -> AttributeSummary | None:
    return event_attribute_summary(ocel, attribute, entity_names)


@router.get(
    "/{ocel_id}/objects/attributes/summary",
    operation_id="getObjectAttributeSummary",
)
def get_object_attribute_summary(
    ocel: ApiOcel,
    attribute: Annotated[str, Query()],
    entity_names: Annotated[list[str] | None, Query()] = None,
    object_value: Annotated[ObjectValueKind, Query()] = "first",
    object_value_at: Annotated[str | None, Query()] = None,
) -> AttributeSummary | None:
    return object_attribute_summary(
        ocel, attribute, entity_names, _selector(object_value, object_value_at)
    )


@router.get("/{ocel_id}/events/attributes/bins", operation_id="getEventAttributeBins")
def get_event_attribute_bins(
    ocel: ApiOcel,
    attribute: Annotated[str, Query()],
    entity_names: Annotated[list[str] | None, Query()] = None,
    bins: Annotated[int, Query(ge=1, le=500)] = 40,
) -> list[AttributeBin]:
    return event_attribute_bins(ocel, attribute, entity_names, bins)


@router.get("/{ocel_id}/objects/attributes/bins", operation_id="getObjectAttributeBins")
def get_object_attribute_bins(
    ocel: ApiOcel,
    attribute: Annotated[str, Query()],
    entity_names: Annotated[list[str] | None, Query()] = None,
    object_value: Annotated[ObjectValueKind, Query()] = "first",
    object_value_at: Annotated[str | None, Query()] = None,
    bins: Annotated[int, Query(ge=1, le=500)] = 40,
) -> list[AttributeBin]:
    return object_attribute_bins(
        ocel, attribute, entity_names, _selector(object_value, object_value_at), bins
    )


@router.get(
    "/{ocel_id}/events/attributes/values", operation_id="getEventAttributeValues"
)
def get_event_attribute_values(
    ocel: ApiOcel,
    attribute: Annotated[str, Query()],
    entity_names: Annotated[list[str] | None, Query()] = None,
    regex: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
    values: Annotated[list[str] | None, Query()] = None,
) -> AttributeValues:
    try:
        return event_attribute_values(
            ocel, attribute, entity_names, regex, search, values
        )
    except duckdb.InvalidInputException as error:
        raise BadRequest(str(error)) from error


@router.get(
    "/{ocel_id}/objects/attributes/values", operation_id="getObjectAttributeValues"
)
def get_object_attribute_values(
    ocel: ApiOcel,
    attribute: Annotated[str, Query()],
    entity_names: Annotated[list[str] | None, Query()] = None,
    object_value: Annotated[ObjectValueKind, Query()] = "first",
    object_value_at: Annotated[str | None, Query()] = None,
    regex: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
    values: Annotated[list[str] | None, Query()] = None,
) -> AttributeValues:
    try:
        return object_attribute_values(
            ocel,
            attribute,
            entity_names,
            _selector(object_value, object_value_at),
            regex,
            search,
            values,
        )
    except duckdb.InvalidInputException as error:
        raise BadRequest(str(error)) from error


def active_filter(handle: SessionOCEL, state: FilterModuleState) -> FilterState | None:
    current = state.ocels.get(handle.id)
    if current is None or current.view_id != handle.active_view_id:
        return None
    return current


@router.get("/{ocel_id}/filter", operation_id="getFilter")
def getFilter(
    ocel_id: str,
    session: ApiSession,
    filters: ApiFilterState,
) -> list[NativeFilter]:
    current = active_filter(session.get_ocel(ocel_id), filters.get())
    return [] if current is None else list(current.pipeline)


@router.post("/{ocel_id}/filter", operation_id="setFilter")
def setFilter(
    ocel_id: str,
    pipeline: list[NativeFilter],
    session: ApiSession,
    filters: ApiFilterState,
):
    handle = session.get_ocel(ocel_id)
    started_at = time.perf_counter()

    view_id = None
    if pipeline:
        view_id = create_filter_view(handle, pipeline, DEFAULT_VIEW_NAME).id
        handle.prepare_view(view_id)

    with filters.update() as state:
        previous = active_filter(handle, state)
        handle.set_active_view(view_id)
        state.ocels[ocel_id] = FilterState(pipeline=list(pipeline), view_id=view_id)
        if previous is not None and previous.view_id not in (None, view_id):
            handle.delete_view(previous.view_id)

    duration = time.perf_counter() - started_at
    ocel_name = handle.name

    with (
        handle.open() as filtered_ocel,
        handle.open(use_original=True) as original_ocel,
    ):
        event_difference = original_ocel.events.count - filtered_ocel.events.count
        object_difference = original_ocel.objects.count - filtered_ocel.objects.count

    sse_manager.send_safe(
        session.id,
        SystemNotification(
            title=f"Successfully filtered {ocel_name}",
            message=f"Filtered out {event_difference} events and {object_difference} objects in {duration:.3f}s",
            notification_type="info",
        ),
    )
