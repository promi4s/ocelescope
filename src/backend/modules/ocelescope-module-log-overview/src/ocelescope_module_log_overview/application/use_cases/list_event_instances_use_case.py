from dataclasses import dataclass
from datetime import datetime

import pandas as pd
from ocelescope import OCEL
from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, EID_COL, TIMESTAMP_COL

from ocelescope_module_log_overview.infrastructure.ocel_helpers import (
    get_event_attribute_series,
)


@dataclass
class EventInstance:
    id: str
    timestamp: datetime
    value: float | None


@dataclass
class EventInstancesResult:
    instances: list[EventInstance]
    matching_count: int
    truncated: bool


DEFAULT_LIMIT = 100
MAX_LIMIT = 500


class ListEventInstancesUseCase:
    """Return a sample of event rows whose attribute value falls in [min, max]."""

    def __init__(self, ocel: OCEL) -> None:
        self._ocel = ocel

    def execute(
        self,
        event_type: str,
        attribute: str,
        *,
        range_min: float | None = None,
        range_max: float | None = None,
        limit: int = DEFAULT_LIMIT,
    ) -> EventInstancesResult:
        limit = max(1, min(limit, MAX_LIMIT))

        # Use the helper for its "unknown event type / attribute" KeyError
        # behaviour, but we then need the unfiltered slice with id/timestamp so
        # work off the underlying frame directly.
        get_event_attribute_series(self._ocel, event_type, attribute)

        df = self._ocel.events.df
        mask = df[ACTIVITY_COL] == event_type
        rows = df.loc[mask, [EID_COL, TIMESTAMP_COL, attribute]].copy()

        numeric = pd.to_numeric(rows[attribute], errors="coerce")
        rows = rows.assign(_value=numeric).dropna(subset=["_value"])

        if range_min is not None:
            rows = rows[rows["_value"] >= range_min]
        if range_max is not None:
            rows = rows[rows["_value"] <= range_max]

        matching_count = int(len(rows))
        truncated = matching_count > limit

        head = rows.sort_values(TIMESTAMP_COL).head(limit)
        instances = [
            EventInstance(
                id=str(row[EID_COL]),
                timestamp=row[TIMESTAMP_COL].to_pydatetime(),
                value=float(row["_value"]),
            )
            for _, row in head.iterrows()
        ]

        return EventInstancesResult(
            instances=instances,
            matching_count=matching_count,
            truncated=truncated,
        )
