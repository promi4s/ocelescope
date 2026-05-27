from fastapi import APIRouter, HTTPException

from ocelescope_module_log_overview.api.schemas import (
    AttributeInfoSchema,
    CategoricalBody,
    CategoricalSchema,
    HistogramBody,
    HistogramSchema,
    KdeBody,
    KdeSchema,
    ViolinBody,
    ViolinSchema,
)
from ocelescope_module_log_overview.dependencies import (
    ComputeEventCategoricalDep,
    ComputeEventHistogramDep,
    ComputeEventKdeDep,
    ComputeEventViolinDep,
    ListEventAttributesDep,
)

router = APIRouter()


@router.post("/{ocel_id}/events/attributes")
def event_attributes(
    use_case: ListEventAttributesDep,
) -> dict[str, list[AttributeInfoSchema]]:
    result = use_case.execute()
    return {
        event_type: [AttributeInfoSchema(name=a.name, type=a.type) for a in attrs]
        for event_type, attrs in result.items()
    }


@router.post("/{ocel_id}/events/{event_type}/{attribute}/histogram")
def event_attribute_histogram(
    use_case: ComputeEventHistogramDep,
    event_type: str,
    attribute: str,
    body: HistogramBody,
) -> HistogramSchema:
    try:
        result = use_case.execute(event_type, attribute, bins=body.bins)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return HistogramSchema.from_domain(result)


@router.post("/{ocel_id}/events/{event_type}/{attribute}/categorical")
def event_attribute_categorical(
    use_case: ComputeEventCategoricalDep,
    event_type: str,
    attribute: str,
    body: CategoricalBody,
) -> CategoricalSchema:
    try:
        result = use_case.execute(event_type, attribute, top_k=body.top_k)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return CategoricalSchema.from_domain(result)


@router.post("/{ocel_id}/events/{event_type}/{attribute}/kde")
def event_attribute_kde(
    use_case: ComputeEventKdeDep,
    event_type: str,
    attribute: str,
    body: KdeBody,
) -> KdeSchema:
    try:
        result = use_case.execute(
            event_type, attribute, n_points=body.n_points, bandwidth=body.bandwidth
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return KdeSchema.from_domain(result)


@router.post("/{ocel_id}/events/{event_type}/{attribute}/violin")
def event_attribute_violin(
    use_case: ComputeEventViolinDep,
    event_type: str,
    attribute: str,
    body: ViolinBody,
) -> ViolinSchema:
    try:
        result = use_case.execute(event_type, attribute, n_points=body.n_points)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return ViolinSchema.from_domain(result)
