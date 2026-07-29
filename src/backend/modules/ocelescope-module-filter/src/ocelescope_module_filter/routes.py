import time
from typing import cast

from fastapi import APIRouter
from ocelescope_backend.app.dependencies import ApiSession
from ocelescope_backend.app.sse_manager import (
    InvalidationRequest,
    SystemNotification,
    sse_manager,
)

from ocelescope_module_filter.filters import FILTER_SOURCE, NativeFilter

router = APIRouter()


@router.get("/{ocel_id}/filter", operation_id="getFilter")
def getFilter(
    ocel_id: str,
    session: ApiSession,
) -> list[NativeFilter]:
    return cast(list[NativeFilter], session.get_filter(ocel_id, FILTER_SOURCE))


@router.post("/{ocel_id}/filter", operation_id="setFilter")
async def setFilter(ocel_id: str, body: list[NativeFilter], session: ApiSession):

    started_at = time.perf_counter()
    session.set_filter(ocel_id, FILTER_SOURCE, body)
    duration = time.perf_counter() - started_at

    ocel_name = session.ocels[ocel_id].name

    with (
        session.get_ocel(ocel_id) as filtered_ocel,
        session.get_ocel(ocel_id, use_original=True) as original_ocel,
    ):
        event_difference = original_ocel.events.count - filtered_ocel.events.count
        object_difference = original_ocel.objects.count - filtered_ocel.objects.count

    await sse_manager.send(
        session_id=session.id,
        message=InvalidationRequest(routes=["ocels"]),
    )

    await sse_manager.send(
        session_id=session.id,
        message=SystemNotification(
            title=f"Successfully filtered {ocel_name}",
            message=f"Filtered out {event_difference} events and {object_difference} objects in {duration:.3f}s",
            notification_type="info",
        ),
    )
