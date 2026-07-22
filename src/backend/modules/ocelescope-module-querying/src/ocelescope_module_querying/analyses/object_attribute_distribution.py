from __future__ import annotations

from typing import cast

import pandas as pd
from pydantic import BaseModel

from ocelescope import OCEL
from ocelescope.ocel.constants import ACTIVITY_COL, OTYPE_COL

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
from ocelescope_module_querying.shared.object_attributes import (
    object_attribute_observations,
    object_attribute_values_at_activity,
)


class ObjectAttributeDistributionQuery(BaseModel):
    activity: str
    object_type: str
    attribute: str
    grouping: DistributionGrouping


class ActivityObjectTypePair(BaseModel):
    activity: str
    object_type: str


class ObjectAttributeDistributionOptionsResponse(BaseModel):
    pairs: list[ActivityObjectTypePair]


def get_object_attribute_distribution_options(
    ocel: OCEL,
) -> ObjectAttributeDistributionOptionsResponse:
    pairs = (
        ocel.e2o.df.loc[:, [ACTIVITY_COL, OTYPE_COL]]
        .dropna()
        .drop_duplicates()
        .sort_values([ACTIVITY_COL, OTYPE_COL], kind="stable")
    )
    return ObjectAttributeDistributionOptionsResponse(
        pairs=[
            ActivityObjectTypePair(
                activity=str(row[ACTIVITY_COL]), object_type=str(row[OTYPE_COL])
            )
            for _, row in pairs.iterrows()
        ]
    )


def execute_object_attribute_distribution_query(
    ocel: OCEL,
    query: ObjectAttributeDistributionQuery,
    *,
    classification_ocel: OCEL | None = None,
) -> DistributionResponse:
    reference_ocel = classification_ocel or ocel
    if not reference_ocel.events.df[ACTIVITY_COL].eq(query.activity).any():
        raise InvalidAnalysisQuery(f"Unknown activity '{query.activity}'")
    if query.object_type not in reference_ocel.objects.types:
        raise InvalidAnalysisQuery(f"Unknown object type '{query.object_type}'")
    valid_pair = reference_ocel.e2o.df.loc[
        reference_ocel.e2o.df[ACTIVITY_COL].eq(query.activity)
        & reference_ocel.e2o.df[OTYPE_COL].eq(query.object_type)
    ]
    if valid_pair.empty:
        raise InvalidAnalysisQuery(
            f"Object type '{query.object_type}' is not involved in activity "
            f"'{query.activity}'"
        )

    observations = object_attribute_observations(
        reference_ocel, query.object_type, query.attribute
    )
    if observations.empty:
        raise InvalidAnalysisQuery(
            f"Unknown object attribute '{query.attribute}' "
            f"for object type '{query.object_type}'"
        )
    classification_values = cast(
        pd.Series, observations[query.attribute].reset_index(drop=True)
    )
    physical_type = attribute_type(classification_values)
    analytical_type = infer_analytical_type(classification_values, physical_type)
    values = object_attribute_values_at_activity(
        ocel, query.activity, query.object_type, query.attribute
    )
    return calculate_distribution(values, analytical_type, query.grouping)
