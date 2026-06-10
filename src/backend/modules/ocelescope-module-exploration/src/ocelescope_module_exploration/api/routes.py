from fastapi import APIRouter, HTTPException

from ocelescope_module_exploration.api.schemas import (
    AttributeInfoSchema,
    EventInstancesBody,
    EventInstancesSchema,
    HistogramBody,
    HistogramSchema,
)
from ocelescope_module_exploration.dependencies import (
    ComputeEventHistogramDep,
    ListEventAttributesDep,
    ListEventInstancesDep,
)

router = APIRouter()


@router.get("/{ocel_id}/events/attributes", operation_id="eventAttributes")
def event_attributes(
    use_case: ListEventAttributesDep,
) -> dict[str, list[AttributeInfoSchema]]:
    result = use_case.execute()
    return {
        event_type: [AttributeInfoSchema(name=a.name, type=a.type) for a in attrs]
        for event_type, attrs in result.items()
    }


@router.post(
    "/{ocel_id}/events/{event_type}/{attribute}/histogram",
    operation_id="eventAttributeHistogram",
)
def event_attribute_histogram(
    use_case: ComputeEventHistogramDep,
    event_type: str,
    attribute: str,
    body: HistogramBody,
) -> HistogramSchema:
    try:
        result = use_case.execute(
            event_type,
            attribute,
            range_min=body.range.min if body.range else None,
            range_max=body.range.max if body.range else None,
            bins=body.bins,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return HistogramSchema.from_domain(result)


@router.post(
    "/{ocel_id}/events/{event_type}/{attribute}/instances",
    operation_id="eventAttributeInstances",
)
def event_attribute_instances(
    use_case: ListEventInstancesDep,
    event_type: str,
    attribute: str,
    body: EventInstancesBody,
) -> EventInstancesSchema:
    try:
        result = use_case.execute(
            event_type,
            attribute,
            range_min=body.range.min if body.range else None,
            range_max=body.range.max if body.range else None,
            limit=body.limit,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return EventInstancesSchema.from_domain(result)
