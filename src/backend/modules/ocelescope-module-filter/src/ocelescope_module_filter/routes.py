import json
import time
from typing import Annotated

from fastapi import APIRouter, Body
from ocelescope.ocel.view import Clean
from ocelescope_backend.app.dependencies import ApiSession
from ocelescope_backend.app.internal.model.ocel import SessionOCEL
from ocelescope_backend.app.internal.model.view import SessionView
from ocelescope_backend.app.sse_manager import SystemNotification, sse_manager

from ocelescope_module_filter.filters import FILTER_SOURCE, NativeFilter
from ocelescope_module_filter.state import (
    ApiFilterState,
    FilterModuleState,
    FilterState,
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
