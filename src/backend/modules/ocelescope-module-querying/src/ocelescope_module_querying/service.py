from __future__ import annotations

from typing import cast

import pandas as pd

from ocelescope import OCEL
from ocelescope.ocel.constants import ACTIVITY_COL, OID_COL, OTYPE_COL

from ocelescope_module_querying.analytical_schema import (
    describe_analytical_schema,
    validate_schema_overrides,
)
from ocelescope_module_querying.api.schemas import (
    ActivityExecutionFrequencyQuery,
    ActivityExecutionFrequencyResponse,
    ActivityExecutionFrequencyRow,
    ActivityEventCount,
    ActivityObjectTypePair,
    AnalyticalType,
    DistributionResponse,
    EventAttributeDistributionQuery,
    ObjectCountPerEventRow,
    ObjectCountsPerEventQuery,
    ObjectCountsPerEventResponse,
    ObjectTypeCombinationRow,
    ObjectTypeCombinationsQuery,
    ObjectTypeCombinationsResponse,
    ObjectAttributeDistributionOptionsResponse,
    ObjectAttributeDistributionQuery,
    ObjectInvolvementDistributionQuery,
    ObjectInvolvementOption,
    ObjectInvolvementOptionsResponse,
    ObjectActivityExecutionDistributionQuery,
    ObjectActivityExecutionDistributionResponse,
    ObjectActivityExecutionDistributionRow,
    TotalObjectInvolvementResponse,
    TotalObjectInvolvementRow,
    NumericBinGrouping,
    TimeBetweenActivitiesQuery,
    TimeBetweenActivitiesResponse,
)
from ocelescope_module_querying.attribute_types import (
    attribute_type,
    effective_analytical_type,
)
from ocelescope_module_querying.distributions import calculate_distribution
from ocelescope_module_querying.errors import InvalidAnalysisQuery
from ocelescope_module_querying.object_attributes import (
    object_attribute_observations,
    object_attribute_values_at_activity,
)
from ocelescope_module_querying.relations import (
    activity_execution_frequency_bands,
    consecutive_activity_pair_durations,
    object_count_frequencies,
    object_involvement_counts,
    object_type_combination_frequencies,
    unique_event_counts,
    variable_object_involvement_pairs,
    variable_activity_execution_frequencies,
    total_object_involvement_frequencies,
)

__all__ = [
    "InvalidAnalysisQuery",
    "describe_analytical_schema",
    "execute_event_attribute_distribution_query",
    "execute_activity_execution_frequency_query",
    "execute_object_attribute_distribution_query",
    "execute_object_counts_per_event_query",
    "execute_object_involvement_distribution_query",
    "execute_object_type_combinations_query",
    "get_object_attribute_distribution_options",
    "get_object_involvement_options",
    "execute_time_between_activities_query",
    "execute_object_activity_execution_distribution_query",
    "execute_total_object_involvement_query",
    "validate_schema_overrides",
]

_SECONDS_PER_UNIT = {
    "seconds": 1,
    "minutes": 60,
    "hours": 60 * 60,
    "days": 24 * 60 * 60,
}


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
    overrides: dict[tuple[str, str, str], AnalyticalType] | None = None,
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
    analytical_type = effective_analytical_type(
        classification_values,
        physical_type,
        (overrides or {}).get(("event", query.activity, query.attribute)),
    )
    return calculate_distribution(values, analytical_type, query.grouping)


def execute_object_attribute_distribution_query(
    ocel: OCEL,
    query: ObjectAttributeDistributionQuery,
    *,
    classification_ocel: OCEL | None = None,
    overrides: dict[tuple[str, str, str], AnalyticalType] | None = None,
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
    analytical_type = effective_analytical_type(
        classification_values,
        physical_type,
        (overrides or {}).get(("object", query.object_type, query.attribute)),
    )
    values = object_attribute_values_at_activity(
        ocel, query.activity, query.object_type, query.attribute
    )
    return calculate_distribution(values, analytical_type, query.grouping)


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


def execute_object_counts_per_event_query(
    ocel: OCEL,
    query: ObjectCountsPerEventQuery,
    *,
    known_activities: set[str] | None = None,
) -> ObjectCountsPerEventResponse:
    """Count how often events involve exactly n unique objects of each type."""
    requested = set(query.activities)
    available = known_activities or {str(value) for value in ocel.events.activities}
    unknown = requested - available
    if unknown:
        names = ", ".join(sorted(unknown))
        raise InvalidAnalysisQuery(f"Unknown activities: {names}")

    frequencies = object_count_frequencies(ocel.e2o.df, requested)
    activity_counts = unique_event_counts(ocel.e2o.df, requested)
    return ObjectCountsPerEventResponse(
        rows=[
            ObjectCountPerEventRow(
                activity=str(row[ACTIVITY_COL]),
                object_type=str(row[OTYPE_COL]),
                object_count=int(row["object_count"]),
                event_count=int(row["event_count"]),
            )
            for _, row in frequencies.iterrows()
        ],
        activity_event_counts=[
            ActivityEventCount(
                activity=str(row[ACTIVITY_COL]),
                event_count=int(row["event_count"]),
            )
            for _, row in activity_counts.iterrows()
        ],
    )


def execute_object_type_combinations_query(
    ocel: OCEL,
    query: ObjectTypeCombinationsQuery,
    *,
    known_activities: set[str] | None = None,
) -> ObjectTypeCombinationsResponse:
    requested = set(query.activities)
    available = known_activities or {str(value) for value in ocel.events.activities}
    unknown = requested - available
    if unknown:
        names = ", ".join(sorted(unknown))
        raise InvalidAnalysisQuery(f"Unknown activities: {names}")

    rows, total_events, represented_events, total_combinations = (
        object_type_combination_frequencies(
            ocel.events.df,
            ocel.e2o.df,
            query.limit,
            requested,
        )
    )
    return ObjectTypeCombinationsResponse(
        rows=[
            ObjectTypeCombinationRow(
                object_types=list(row["object_types"]),
                activity=str(row[ACTIVITY_COL]),
                event_count=int(row["event_count"]),
            )
            for _, row in rows.iterrows()
        ],
        total_event_count=total_events,
        represented_event_count=represented_events,
        total_combination_count=total_combinations,
        truncated=total_combinations > query.limit,
    )


def execute_activity_execution_frequency_query(
    ocel: OCEL,
    query: ActivityExecutionFrequencyQuery,
    *,
    known_object_types: set[str] | None = None,
) -> ActivityExecutionFrequencyResponse:
    available = known_object_types or set(ocel.objects.types)
    if query.object_type not in available:
        raise InvalidAnalysisQuery(f"Unknown object type '{query.object_type}'")

    rows, pair_count, object_count, maximum = activity_execution_frequency_bands(
        ocel.events.df,
        ocel.e2o.df,
        query.object_type,
    )
    return ActivityExecutionFrequencyResponse(
        rows=[
            ActivityExecutionFrequencyRow(
                activity=str(row[ACTIVITY_COL]),
                lower_bound=int(row["lower_bound"]),
                upper_bound=(
                    None if pd.isna(row["upper_bound"]) else int(row["upper_bound"])
                ),
                label=str(row["label"]),
                object_count=int(row["object_count"]),
            )
            for _, row in rows.iterrows()
        ],
        object_activity_pair_count=pair_count,
        object_count=object_count,
        maximum_execution_count=maximum,
    )


def get_object_involvement_options(
    ocel: OCEL,
) -> ObjectInvolvementOptionsResponse:
    pairs = variable_object_involvement_pairs(ocel.events.df, ocel.e2o.df)
    return ObjectInvolvementOptionsResponse(
        pairs=[
            ObjectInvolvementOption(
                activity=str(row[ACTIVITY_COL]),
                object_type=str(row[OTYPE_COL]),
                minimum=int(row["minimum"]),
                maximum=int(row["maximum"]),
            )
            for _, row in pairs.iterrows()
        ]
    )


def execute_object_involvement_distribution_query(
    ocel: OCEL,
    query: ObjectInvolvementDistributionQuery,
    *,
    classification_ocel: OCEL | None = None,
) -> DistributionResponse:
    reference_ocel = classification_ocel or ocel
    valid_pairs = variable_object_involvement_pairs(
        reference_ocel.events.df,
        reference_ocel.e2o.df,
    )
    valid = valid_pairs.loc[
        valid_pairs[ACTIVITY_COL].eq(query.activity)
        & valid_pairs[OTYPE_COL].eq(query.object_type)
    ]
    if valid.empty:
        raise InvalidAnalysisQuery(
            f"Activity '{query.activity}' and object type '{query.object_type}' "
            "do not form a variable involvement relation"
        )
    values = object_involvement_counts(
        ocel.events.df,
        ocel.e2o.df,
        query.activity,
        query.object_type,
    )
    return calculate_distribution(
        values,
        "discrete",
        query.grouping,
    )


def execute_time_between_activities_query(
    ocel: OCEL,
    query: TimeBetweenActivitiesQuery,
    *,
    known_activities: set[str] | None = None,
    known_object_types: set[str] | None = None,
) -> TimeBetweenActivitiesResponse:
    available_activities = known_activities or {
        str(value) for value in ocel.events.activities
    }
    unknown = {
        query.source_activity,
        query.target_activity,
    } - available_activities
    if unknown:
        raise InvalidAnalysisQuery(
            f"Unknown activities: {', '.join(sorted(unknown))}"
        )
    available_object_types = known_object_types or set(ocel.objects.types)
    if query.object_type not in available_object_types:
        raise InvalidAnalysisQuery(f"Unknown object type '{query.object_type}'")

    pairs = consecutive_activity_pair_durations(
        ocel.events.df,
        ocel.e2o.df,
        query.source_activity,
        query.target_activity,
        query.object_type,
    )
    values = pairs["duration_seconds"] / _SECONDS_PER_UNIT[query.unit]
    distribution = calculate_distribution(
        values,
        "continuous",
        NumericBinGrouping(kind="bins", count=query.bin_count),
    )
    return TimeBetweenActivitiesResponse(
        **distribution.model_dump(),
        unit=query.unit,
        pair_count=len(pairs),
        contributing_object_count=int(pairs[OID_COL].nunique()),
    )


def execute_object_activity_execution_distribution_query(
    ocel: OCEL,
    query: ObjectActivityExecutionDistributionQuery,
    *,
    known_object_types: set[str] | None = None,
) -> ObjectActivityExecutionDistributionResponse:
    available = known_object_types or set(ocel.objects.types)
    if query.object_type not in available:
        raise InvalidAnalysisQuery(f"Unknown object type '{query.object_type}'")
    rows, object_count, activity_count = variable_activity_execution_frequencies(
        ocel.events.df,
        ocel.e2o.df,
        query.object_type,
    )
    return ObjectActivityExecutionDistributionResponse(
        rows=[
            ObjectActivityExecutionDistributionRow(
                activity=str(row[ACTIVITY_COL]),
                execution_count=int(row["execution_count"]),
                object_count=int(row["object_count"]),
            )
            for _, row in rows.iterrows()
        ],
        contributing_object_count=object_count,
        activity_count=activity_count,
    )


def execute_total_object_involvement_query(
    ocel: OCEL,
) -> TotalObjectInvolvementResponse:
    rows, event_count = total_object_involvement_frequencies(
        ocel.events.df,
        ocel.e2o.df,
    )
    return TotalObjectInvolvementResponse(
        rows=[
            TotalObjectInvolvementRow(
                activity=str(row[ACTIVITY_COL]),
                object_count=int(row["object_count"]),
                event_count=int(row["event_count"]),
            )
            for _, row in rows.iterrows()
        ],
        event_count=event_count,
    )
