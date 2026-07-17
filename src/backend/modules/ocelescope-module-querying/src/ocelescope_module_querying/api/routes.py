from fastapi import APIRouter, HTTPException

from ocelescope_backend.app.dependencies import ApiOcel, ApiSession
from ocelescope_backend.app.internal.exceptions import NotFound

from ocelescope_module_querying.api.schemas import (
    ActivityExecutionFrequencyQuery,
    ActivityExecutionFrequencyResponse,
    AnalyticalSchemaResponse,
    DistributionResponse,
    EventAttributeDistributionQuery,
    ObjectCountsPerEventQuery,
    ObjectCountsPerEventResponse,
    ObjectTypeCombinationsQuery,
    ObjectTypeCombinationsResponse,
    ObjectAttributeDistributionQuery,
    ObjectAttributeDistributionOptionsResponse,
    ObjectInvolvementDistributionQuery,
    ObjectInvolvementOptionsResponse,
    UpdateAnalyticalSchemaRequest,
    TimeBetweenActivitiesQuery,
    TimeBetweenActivitiesResponse,
    ObjectActivityExecutionDistributionQuery,
    ObjectActivityExecutionDistributionResponse,
    TotalObjectInvolvementResponse,
)
from ocelescope_module_querying.service import (
    InvalidAnalysisQuery,
    describe_analytical_schema,
    execute_activity_execution_frequency_query,
    execute_event_attribute_distribution_query,
    execute_object_attribute_distribution_query,
    execute_object_counts_per_event_query,
    execute_object_involvement_distribution_query,
    execute_object_type_combinations_query,
    get_object_attribute_distribution_options,
    get_object_involvement_options,
    validate_schema_overrides,
    execute_time_between_activities_query,
    execute_object_activity_execution_distribution_query,
    execute_total_object_involvement_query,
)
from ocelescope_module_querying.state import QueryingState

router = APIRouter(prefix="/ocels", tags=["querying"])


@router.get("/{ocel_id}/analytical-schema", operation_id="getAnalyticalSchema")
def get_analytical_schema(
    ocel_id: str, session: ApiSession
) -> AnalyticalSchemaResponse:
    try:
        ocel = session.get_ocel(ocel_id, use_original=True)
    except NotFound as error:
        raise HTTPException(status_code=404, detail="OCEL not found") from error
    state = session.get_module_state("querying", QueryingState)
    return describe_analytical_schema(ocel, state.get_schema_overrides(ocel_id))


@router.put("/{ocel_id}/analytical-schema", operation_id="updateAnalyticalSchema")
def update_analytical_schema(
    ocel_id: str,
    session: ApiSession,
    body: UpdateAnalyticalSchemaRequest,
) -> AnalyticalSchemaResponse:
    try:
        ocel = session.get_ocel(ocel_id, use_original=True)
        overrides = validate_schema_overrides(ocel, body.overrides)
    except NotFound as error:
        raise HTTPException(status_code=404, detail="OCEL not found") from error
    except InvalidAnalysisQuery as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    state = session.get_module_state("querying", QueryingState)
    state.set_schema_overrides(ocel_id, overrides)
    session.update_state()
    return describe_analytical_schema(ocel, overrides)


@router.post(
    "/{ocel_id}/queries/event-attribute-distribution",
    operation_id="queryEventAttributeDistribution",
)
def query_event_attribute_distribution(
    ocel_id: str,
    ocel: ApiOcel,
    session: ApiSession,
    body: EventAttributeDistributionQuery,
) -> DistributionResponse:
    try:
        original_ocel = session.get_ocel(ocel_id, use_original=True)
        state = session.get_module_state("querying", QueryingState)
        return execute_event_attribute_distribution_query(
            ocel,
            body,
            classification_ocel=original_ocel,
            overrides=state.get_schema_overrides(ocel_id),
        )
    except InvalidAnalysisQuery as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get(
    "/{ocel_id}/queries/object-attribute-distribution/options",
    operation_id="getObjectAttributeDistributionOptions",
)
def object_attribute_distribution_options(
    ocel_id: str, session: ApiSession
) -> ObjectAttributeDistributionOptionsResponse:
    try:
        ocel = session.get_ocel(ocel_id, use_original=True)
    except NotFound as error:
        raise HTTPException(status_code=404, detail="OCEL not found") from error
    return get_object_attribute_distribution_options(ocel)


@router.post(
    "/{ocel_id}/queries/object-attribute-distribution",
    operation_id="queryObjectAttributeDistribution",
)
def query_object_attribute_distribution(
    ocel_id: str,
    ocel: ApiOcel,
    session: ApiSession,
    body: ObjectAttributeDistributionQuery,
) -> DistributionResponse:
    try:
        original_ocel = session.get_ocel(ocel_id, use_original=True)
        state = session.get_module_state("querying", QueryingState)
        return execute_object_attribute_distribution_query(
            ocel,
            body,
            classification_ocel=original_ocel,
            overrides=state.get_schema_overrides(ocel_id),
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
    session: ApiSession,
    body: ObjectCountsPerEventQuery,
) -> ObjectCountsPerEventResponse:
    try:
        original_ocel = session.get_ocel(ocel_id, use_original=True)
        return execute_object_counts_per_event_query(
            ocel,
            body,
            known_activities={
                str(activity) for activity in original_ocel.events.activities
            },
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
    session: ApiSession,
    body: ObjectTypeCombinationsQuery,
) -> ObjectTypeCombinationsResponse:
    try:
        original_ocel = session.get_ocel(ocel_id, use_original=True)
        return execute_object_type_combinations_query(
            ocel,
            body,
            known_activities={
                str(activity) for activity in original_ocel.events.activities
            },
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
    session: ApiSession,
    body: ActivityExecutionFrequencyQuery,
) -> ActivityExecutionFrequencyResponse:
    try:
        original_ocel = session.get_ocel(ocel_id, use_original=True)
        return execute_activity_execution_frequency_query(
            ocel,
            body,
            known_object_types=set(original_ocel.objects.types),
        )
    except InvalidAnalysisQuery as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get(
    "/{ocel_id}/queries/object-involvement-distribution/options",
    operation_id="getObjectInvolvementOptions",
)
def object_involvement_options(
    ocel_id: str,
    session: ApiSession,
) -> ObjectInvolvementOptionsResponse:
    try:
        ocel = session.get_ocel(ocel_id, use_original=True)
    except NotFound as error:
        raise HTTPException(status_code=404, detail="OCEL not found") from error
    return get_object_involvement_options(ocel)


@router.post(
    "/{ocel_id}/queries/object-involvement-distribution",
    operation_id="queryObjectInvolvementDistribution",
)
def query_object_involvement_distribution(
    ocel_id: str,
    ocel: ApiOcel,
    session: ApiSession,
    body: ObjectInvolvementDistributionQuery,
) -> DistributionResponse:
    try:
        original_ocel = session.get_ocel(ocel_id, use_original=True)
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
    session: ApiSession,
    body: TimeBetweenActivitiesQuery,
) -> TimeBetweenActivitiesResponse:
    try:
        original_ocel = session.get_ocel(ocel_id, use_original=True)
        return execute_time_between_activities_query(
            ocel,
            body,
            known_activities={
                str(activity) for activity in original_ocel.events.activities
            },
            known_object_types=set(original_ocel.objects.types),
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
    session: ApiSession,
    body: ObjectActivityExecutionDistributionQuery,
) -> ObjectActivityExecutionDistributionResponse:
    try:
        original_ocel = session.get_ocel(ocel_id, use_original=True)
        return execute_object_activity_execution_distribution_query(
            ocel,
            body,
            known_object_types=set(original_ocel.objects.types),
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
