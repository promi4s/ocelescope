from __future__ import annotations

from pydantic import BaseModel

from ocelescope import OCEL
from ocelescope.ocel.constants import ACTIVITY_COL, OTYPE_COL
from ocelescope_module_ocel.util.attributes import merged_object_table, typed_attributes

from ocelescope_module_exploration.errors import InvalidAnalysisQuery
from ocelescope_module_exploration.shared.distributions import (
    DistributionGrouping,
    DistributionResponse,
    calculate_distribution,
)
from ocelescope_module_exploration.shared.object_attributes import (
    object_attribute_observations,
    object_attribute_values_at_activity,
)


class ObjectAttributeDistributionQuery(BaseModel):
    activity: str
    object_type: str
    attribute: str
    grouping: DistributionGrouping


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
    table = merged_object_table(reference_ocel, [query.attribute], [query.object_type])
    typed = typed_attributes(table)
    analytical_type = typed[0].analytical_type if typed else "unknown"
    values = object_attribute_values_at_activity(
        ocel, query.activity, query.object_type, query.attribute
    )
    return calculate_distribution(values, analytical_type, query.grouping)
