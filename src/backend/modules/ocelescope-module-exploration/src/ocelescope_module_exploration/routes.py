from fastapi import APIRouter, HTTPException

from ocelescope_backend.app.dependencies import ApiOcel

from ocelescope_module_exploration.analyses.activity_execution_frequency import (
    ActivityExecutionFrequencyQuery,
    ActivityExecutionFrequencyResponse,
    execute_activity_execution_frequency_query,
)
from ocelescope_module_exploration.analyses.object_activity_execution_distribution import (
    ObjectActivityExecutionDistributionQuery,
    ObjectActivityExecutionDistributionResponse,
    execute_object_activity_execution_distribution_query,
)
from ocelescope_module_exploration.analyses.object_attribute_distribution import (
    ObjectAttributeDistributionQuery,
    execute_object_attribute_distribution_query,
)
from ocelescope_module_exploration.analyses.object_counts_per_event import (
    ObjectCountsPerEventQuery,
    ObjectCountsPerEventResponse,
    execute_object_counts_per_event_query,
)
from ocelescope_module_exploration.analyses.object_involvement_distribution import (
    ObjectInvolvementDistributionQuery,
    execute_object_involvement_distribution_query,
)
from ocelescope_module_exploration.analyses.object_type_combinations import (
    ObjectTypeCombinationsQuery,
    ObjectTypeCombinationsResponse,
    execute_object_type_combinations_query,
)
from ocelescope_module_exploration.analyses.event_attribute_distribution import (
    EventAttributeDistributionQuery,
    execute_event_attribute_distribution_query,
)
from ocelescope_module_exploration.analyses.time_between_activities import (
    TimeBetweenActivitiesQuery,
    TimeBetweenActivitiesResponse,
    execute_time_between_activities_query,
)
from ocelescope_module_exploration.analyses.total_object_involvement import (
    TotalObjectInvolvementResponse,
    execute_total_object_involvement_query,
)
from ocelescope_module_exploration.dependencies import (
    ApiOriginalOcel,
    known_activities,
    known_object_types,
)
from ocelescope_module_exploration.errors import InvalidAnalysisQuery
from ocelescope_module_exploration.shared.distributions import DistributionResponse

router = APIRouter(prefix="/ocels", tags=["exploration"])


@router.post(
    "/{ocel_id}/queries/event-attribute-distribution",
    operation_id="queryEventAttributeDistribution",
)
def query_event_attribute_distribution(
    ocel_id: str,
    ocel: ApiOcel,
    original_ocel: ApiOriginalOcel,
    body: EventAttributeDistributionQuery,
) -> DistributionResponse:
    del ocel_id
    try:
        return execute_event_attribute_distribution_query(
            ocel,
            body,
            classification_ocel=original_ocel,
        )
    except InvalidAnalysisQuery as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post(
    "/{ocel_id}/queries/object-attribute-distribution",
    operation_id="queryObjectAttributeDistribution",
)
def query_object_attribute_distribution(
    ocel_id: str,
    ocel: ApiOcel,
    original_ocel: ApiOriginalOcel,
    body: ObjectAttributeDistributionQuery,
) -> DistributionResponse:
    del ocel_id
    try:
        return execute_object_attribute_distribution_query(
            ocel,
            body,
            classification_ocel=original_ocel,
        )
    except InvalidAnalysisQuery as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post(
    "/{ocel_id}/queries/object-counts-per-event",
    operation_id="queryObjectCountsPerEvent",
)
def query_object_counts_per_event(
    ocel_id: str,
    ocel: ApiOcel,
    original_ocel: ApiOriginalOcel,
    body: ObjectCountsPerEventQuery,
) -> ObjectCountsPerEventResponse:
    del ocel_id
    try:
        return execute_object_counts_per_event_query(
            ocel,
            body,
            known_activities=known_activities(original_ocel),
        )
    except InvalidAnalysisQuery as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post(
    "/{ocel_id}/queries/object-type-combinations",
    operation_id="queryObjectTypeCombinations",
)
def query_object_type_combinations(
    ocel_id: str,
    ocel: ApiOcel,
    original_ocel: ApiOriginalOcel,
    body: ObjectTypeCombinationsQuery,
) -> ObjectTypeCombinationsResponse:
    del ocel_id
    try:
        return execute_object_type_combinations_query(
            ocel,
            body,
            known_activities=known_activities(original_ocel),
        )
    except InvalidAnalysisQuery as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post(
    "/{ocel_id}/queries/activity-execution-frequency",
    operation_id="queryActivityExecutionFrequency",
)
def query_activity_execution_frequency(
    ocel_id: str,
    ocel: ApiOcel,
    original_ocel: ApiOriginalOcel,
    body: ActivityExecutionFrequencyQuery,
) -> ActivityExecutionFrequencyResponse:
    del ocel_id
    try:
        return execute_activity_execution_frequency_query(
            ocel,
            body,
            known_object_types=known_object_types(original_ocel),
        )
    except InvalidAnalysisQuery as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post(
    "/{ocel_id}/queries/object-involvement-distribution",
    operation_id="queryObjectInvolvementDistribution",
)
def query_object_involvement_distribution(
    ocel_id: str,
    ocel: ApiOcel,
    original_ocel: ApiOriginalOcel,
    body: ObjectInvolvementDistributionQuery,
) -> DistributionResponse:
    del ocel_id
    try:
        return execute_object_involvement_distribution_query(
            ocel,
            body,
            classification_ocel=original_ocel,
        )
    except InvalidAnalysisQuery as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post(
    "/{ocel_id}/queries/time-between-activities",
    operation_id="queryTimeBetweenActivities",
)
def query_time_between_activities(
    ocel_id: str,
    ocel: ApiOcel,
    original_ocel: ApiOriginalOcel,
    body: TimeBetweenActivitiesQuery,
) -> TimeBetweenActivitiesResponse:
    del ocel_id
    try:
        return execute_time_between_activities_query(
            ocel,
            body,
            known_activities=known_activities(original_ocel),
            known_object_types=known_object_types(original_ocel),
        )
    except InvalidAnalysisQuery as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post(
    "/{ocel_id}/queries/object-activity-execution-distribution",
    operation_id="queryObjectActivityExecutionDistribution",
)
def query_object_activity_execution_distribution(
    ocel_id: str,
    ocel: ApiOcel,
    original_ocel: ApiOriginalOcel,
    body: ObjectActivityExecutionDistributionQuery,
) -> ObjectActivityExecutionDistributionResponse:
    del ocel_id
    try:
        return execute_object_activity_execution_distribution_query(
            ocel,
            body,
            known_object_types=known_object_types(original_ocel),
        )
    except InvalidAnalysisQuery as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post(
    "/{ocel_id}/queries/total-object-involvement",
    operation_id="queryTotalObjectInvolvement",
)
def query_total_object_involvement(
    ocel_id: str,
    ocel: ApiOcel,
) -> TotalObjectInvolvementResponse:
    del ocel_id
    return execute_total_object_involvement_query(ocel)
