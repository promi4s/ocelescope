"""Counts per type and the time distribution of a log's events."""

from __future__ import annotations

from collections import defaultdict

import pandas as pd
from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, OTYPE_COL, TIMESTAMP_COL
from ocelescope.ocel.constants.tables import EVENTS_TABLE, OBJECTS_TABLE
from ocelescope.ocel.view import OCELView
from ocelescope.util.sql import ident

from ocelescope import OCEL
from ocelescope_module_ocel.models import Date_Distribution_Item, Entity_Time_Info


def _counts(ocel: OCEL | OCELView, table: str, type_col: str) -> dict[str, int]:
    """How many rows of ``table`` each type has, most frequent first, ties by name."""
    type_col = ident(type_col)
    return {
        str(name): int(count)
        for name, count in ocel.sql(
            f"SELECT {type_col}, count(*) AS n FROM {ident(table)} "
            f"GROUP BY {type_col} ORDER BY n DESC, {type_col}"
        ).fetchall()
    }


def event_counts(ocel: OCEL | OCELView) -> dict[str, int]:
    """Events per activity, most frequent first."""
    return _counts(ocel, EVENTS_TABLE, ACTIVITY_COL)


def object_counts(ocel: OCEL | OCELView) -> dict[str, int]:
    """Objects per type, most frequent first."""
    return _counts(ocel, OBJECTS_TABLE, OTYPE_COL)


def time_info(
    ocel: OCEL | OCELView,
    periods: int | None = None,
    freq: str | None = None,
) -> Entity_Time_Info:
    """The events' time span, split into windows counted per activity.

    The windows are ``periods`` equal parts of the span, or ``freq`` apart; an
    event on a window's end falls in that window, and the first window also
    takes the event on its start. A log without events has an empty span.
    """
    timestamp, activity = ident(TIMESTAMP_COL), ident(ACTIVITY_COL)
    start_time, end_time = ocel.sql(
        f"SELECT min({timestamp}), max({timestamp}) FROM {ident(EVENTS_TABLE)}"
    ).fetchall()[0]
    if start_time is None:
        return Entity_Time_Info(start_time="", end_time="", date_distribution=[])

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
        SELECT w.window_id, e.{activity} AS activity, count(*) AS count
        FROM {ident(EVENTS_TABLE)} e JOIN windows w
          ON (e.{timestamp} > w.win_start AND e.{timestamp} <= w.win_end)
             OR (w.window_id = 0 AND e.{timestamp} = w.win_start)
        GROUP BY w.window_id, e.{activity}
        """,
        [edges],
    ).fetchall()

    counts_by_window: dict[int, dict[str, int]] = defaultdict(dict)
    for window_id, name, count in rows:
        counts_by_window[window_id][name] = int(count)

    return Entity_Time_Info(
        start_time=start_time.isoformat(),
        end_time=end_time.isoformat(),
        date_distribution=[
            Date_Distribution_Item(
                start_timestamp=edges[window_id].isoformat(),
                end_timestamp=edges[window_id + 1].isoformat(),
                entity_count=counts_by_window[window_id],
            )
            for window_id in sorted(counts_by_window)
        ],
    )
