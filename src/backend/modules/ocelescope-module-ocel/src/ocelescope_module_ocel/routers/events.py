"""Event-centric summaries: activities, counts, ids and the time distribution."""

from __future__ import annotations

from fastapi import APIRouter
from ocelescope.ocel.constants.pm4py import EID_COL
from ocelescope_backend.app.dependencies import ApiOcel
from ocelescope_backend.app.internal.model.base import PaginatedResponse

from ocelescope_module_ocel.models import Entity_Time_Info
from ocelescope_module_ocel.util import events as event_util
from ocelescope_module_ocel.util.pagination import paginate_ids

router = APIRouter()


@router.get("/{ocel_id}/events/activityNames", operation_id="Activities")
def get_activities(ocel: ApiOcel) -> list[str]:
    return ocel.events.activities


@router.get(
    "/{ocel_id}/events/counts",
    response_model=dict[str, int],
    operation_id="eventCounts",
)
def get_event_counts(ocel: ApiOcel) -> dict[str, int]:
    # Ordered most frequent first, which the response preserves.
    return event_util.event_counts(ocel)


@router.get("/{ocel_id}/events/ids", operation_id="eventIds")
def get_event_ids(
    ocel: ApiOcel,
    search: str | None = None,
    size: int = 10,
    page: int = 1,
) -> PaginatedResponse[list[str]]:
    return paginate_ids(ocel.events.table, EID_COL, search, page, size)


@router.get(
    "/{ocel_id}/events/time",
    response_model=Entity_Time_Info,
    operation_id="timeInfo",
)
def get_time_info(
    ocel: ApiOcel, periods: int | None = None, freq: str | None = None
) -> Entity_Time_Info:
    return event_util.time_info(ocel, periods, freq)
