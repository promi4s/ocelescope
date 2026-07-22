from __future__ import annotations

from typing import cast

import pandas as pd
from pydantic import BaseModel

from ocelescope import OCEL
from ocelescope.ocel.constants import ACTIVITY_COL

from ocelescope_module_querying.errors import InvalidAnalysisQuery
from ocelescope_module_querying.shared.attribute_types import (
    attribute_type,
    infer_analytical_type,
)
from ocelescope_module_querying.shared.distributions import (
    DistributionGrouping,
    DistributionResponse,
    calculate_distribution,
)


class EventAttributeDistributionQuery(BaseModel):
    activity: str
    attribute: str
    grouping: DistributionGrouping


def _event_attribute_values(
    ocel: OCEL,
    activity: str,
    attribute: str,
    *,
    allow_empty_activity: bool = False,
) -> pd.Series:
    events = ocel.events.df
    activity_mask = events[ACTIVITY_COL].eq(activity)
    if not allow_empty_activity and not activity_mask.any():
        raise InvalidAnalysisQuery(f"Unknown activity '{activity}'")
    if attribute not in ocel.events.attribute_names:
        raise InvalidAnalysisQuery(f"Unknown event attribute '{attribute}'")
    return cast(pd.Series, events.loc[activity_mask, attribute].reset_index(drop=True))


def execute_event_attribute_distribution_query(
    ocel: OCEL,
    query: EventAttributeDistributionQuery,
    *,
    classification_ocel: OCEL | None = None,
) -> DistributionResponse:
    classification_values = _event_attribute_values(
        classification_ocel or ocel, query.activity, query.attribute
    )
    values = _event_attribute_values(
        ocel,
        query.activity,
        query.attribute,
        allow_empty_activity=classification_ocel is not None,
    )
    physical_type = attribute_type(classification_values)
    analytical_type = infer_analytical_type(classification_values, physical_type)
    return calculate_distribution(values, analytical_type, query.grouping)
