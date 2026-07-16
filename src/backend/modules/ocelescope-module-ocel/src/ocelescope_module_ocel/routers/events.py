"""Event-centric summaries: activities, counts, ids and the time distribution."""

from __future__ import annotations

from collections import defaultdict

import pandas as pd
from fastapi import APIRouter
from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, EID_COL, TIMESTAMP_COL
from ocelescope_backend.app.dependencies import ApiOcel
from ocelescope_backend.app.internal.model.base import PaginatedResponse

from ocelescope_module_ocel.models import Date_Distribution_Item, Entity_Time_Info
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
    return {
        str(activity): int(count)
        for activity, count in ocel.events.activity_counts.items()
    }


@router.get("/{ocel_id}/events/ids", operation_id="eventIds")
def get_event_ids(
    ocel: ApiOcel,
    search: str | None = None,
    size: int = 10,
    page: int = 1,
) -> PaginatedResponse[list[str]]:
    return paginate_ids(
        ocel.events.table, EID_COL, search, page, size, order_by=[TIMESTAMP_COL]
    )


@router.get(
    "/{ocel_id}/events/time",
    response_model=Entity_Time_Info,
    operation_id="timeInfo",
)
def get_time_info(
    ocel: ApiOcel, periods: int | None = None, freq: str | None = None
) -> Entity_Time_Info:

    span = ocel.events.table.aggregate(
        f'min("{TIMESTAMP_COL}") AS start, max("{TIMESTAMP_COL}") AS end'
    ).fetchone()
    assert span is not None
    start_time, end_time = span

    bins = pd.date_range(start_time, end_time, periods=periods, freq=freq)
    if len(bins) < 2:
        return Entity_Time_Info(
            start_time=start_time.isoformat(),
            end_time=end_time.isoformat(),
            date_distribution=[],
        )
    edges = [edge.to_pydatetime() for edge in bins]

    rows = ocel.sql(
        f"""
        WITH bounds AS (SELECT ? AS edges),
        windows AS (
            SELECT i AS window_id, edges[i + 1] AS win_start, edges[i + 2] AS win_end
            FROM bounds, range(0, len(edges) - 1) AS steps(i)
        )
        SELECT w.window_id, e."{ACTIVITY_COL}" AS activity, count(*) AS count
        FROM events e JOIN windows w
          ON (e."{TIMESTAMP_COL}" > w.win_start AND e."{TIMESTAMP_COL}" <= w.win_end)
             OR (w.window_id = 0 AND e."{TIMESTAMP_COL}" = w.win_start)
        GROUP BY w.window_id, e."{ACTIVITY_COL}"
        """,
        [edges],
    ).fetchall()

    counts_by_window: dict[int, dict[str, int]] = defaultdict(dict)
    for window_id, activity, count in rows:
        counts_by_window[window_id][activity] = int(count)

    date_distribution = [
        Date_Distribution_Item(
            start_timestamp=edges[window_id].isoformat(),
            end_timestamp=edges[window_id + 1].isoformat(),
            entity_count=counts_by_window[window_id],
        )
        for window_id in sorted(counts_by_window)
    ]

    return Entity_Time_Info(
        start_time=start_time.isoformat(),
        end_time=end_time.isoformat(),
        date_distribution=date_distribution,
    )
