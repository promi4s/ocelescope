from typing import Annotated

import numpy as np
import pandas as pd
from fastapi import APIRouter, Query
from ocelescope.ocel.constants.pm4py import ACTIVITY_COL
from ocelescope_backend.app.dependencies import ApiOcel

from ocelescope_module_log_overview.models import NumericValues

router = APIRouter()


@router.get(
    "/{ocel_id}/events/attributes/{attribute}/values",
    response_model=NumericValues,
    operation_id="eventAttributeValues",
)
def event_attribute_values(
    ocel: ApiOcel,
    attribute: str,
    activity: Annotated[str | None, Query()] = None,
) -> NumericValues:
    df = ocel.events.df
    if activity is not None:
        df = df[df[ACTIVITY_COL] == activity]

    total = len(df)

    if attribute not in df.columns:
        return NumericValues(values=[], missing_count=total)
    numeric = pd.to_numeric(df[attribute], errors="coerce")
    values = [v for v in numeric.tolist() if v is not None and not np.isnan(v)]
    missing_count = total - len(values)
    return NumericValues(values=values, missing_count=missing_count)
