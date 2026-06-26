from typing import Any

from fastapi import APIRouter, HTTPException
from ocelescope.ocel.filter.base import BaseFilter
from pydantic import BaseModel, ValidationError

from ocelescope import (
    EventTypeFilter,
    EventTypeFrequencyFilter,
    ObjectTypeFilter,
    ObjectTypeFrequencyFilter,
)
from ocelescope_backend.app.dependencies import ApiSession
from ocelescope_backend.app.internal.discovery import discovery_registry
from ocelescope_backend.app.internal.exceptions import NotFound
from ocelescope_backend.app.internal.model.discovery import (
    CreateDiscoveryTaskBody,
    DiscoveryMethodMeta,
    DiscoveryRequest,
    DiscoveryVariant,
)
from ocelescope_backend.app.internal.tasks.discovery_task import (
    DiscoveryTask,
    DiscoveryTaskSummary,
)

_DISCOVERY_FILTER_TYPES: list[type[BaseFilter]] = [
    EventTypeFilter,
    ObjectTypeFilter,
    EventTypeFrequencyFilter,
    ObjectTypeFrequencyFilter,
]

_DISCOVERY_FILTERS_BY_NAME: dict[str, type[BaseFilter]] = {
    cls.__name__: cls for cls in _DISCOVERY_FILTER_TYPES
}


class DiscoveryFilterSchema(BaseModel):
    name: str
    json_schema: dict[str, Any]


discovery_router = APIRouter(prefix="/discovery", tags=["discovery"])


@discovery_router.post(
    "/ocels/{ocel_id}/tasks",
    summary="Create a discovery task",
    operation_id="createDiscoveryTask",
)
def create_discovery_task(
    session: ApiSession,
    ocel_id: str,
    body: CreateDiscoveryTaskBody,
) -> str:
    try:
        info = discovery_registry.get(body.method_id)
        parsed_parameters = info.parse_parameters(body.parameters)
        parameters = info.dump_parameters(parsed_parameters)
    except KeyError:
        raise HTTPException(
            status_code=404,
            detail=f"Discovery method '{body.method_id}' is not registered",
        )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc

    filter_pipeline: list[BaseFilter] = []
    for envelope in body.filters:
        filter_cls = _DISCOVERY_FILTERS_BY_NAME.get(envelope.name)
        if filter_cls is None:
            raise HTTPException(
                status_code=422,
                detail=f"Unknown discovery filter '{envelope.name}'",
            )
        try:
            filter_pipeline.append(filter_cls.model_validate(envelope.payload))
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail=exc.errors()) from exc

    return DiscoveryTask.create_discovery_task(
        session=session,
        request=DiscoveryRequest(
            ocel_id=ocel_id,
            method_id=info.method_id,
            name=info.name,
            resource_type=info.resource_type.get_type(),
            parameters=parameters,
            filters=filter_pipeline,
        ),
    )


@discovery_router.get("/tasks/{task_id}", operation_id="DiscoveryTask")
def get_discovery_task(
    session: ApiSession,
    task_id: str,
) -> DiscoveryTaskSummary:
    discovery_task = session.get_task(task_id)

    if discovery_task is None or not isinstance(discovery_task, DiscoveryTask):
        raise NotFound("Task could not be found")

    return discovery_task.summarize()


@discovery_router.post("/tasks/{task_id}", operation_id="saveDiscovery")
def save_discovery(
    session: ApiSession,
    task_id: str,
):
    discovery_task = session.get_task(task_id)

    if discovery_task is None or not isinstance(discovery_task, DiscoveryTask):
        raise NotFound("Task could not be found")

    return discovery_task.save_resource()


@discovery_router.get(
    "/filters",
    summary="List filters available to discovery tasks",
    operation_id="listDiscoveryFilters",
)
def list_discovery_filters() -> list[DiscoveryFilterSchema]:
    return [
        DiscoveryFilterSchema(
            name=filter_cls.__name__,
            json_schema=filter_cls.model_json_schema(),
        )
        for filter_cls in _DISCOVERY_FILTER_TYPES
    ]


@discovery_router.get(
    "/methods",
    summary="List discovery methods",
    operation_id="listDiscoveryMethods",
)
def list_discovery_methods() -> list[DiscoveryMethodMeta]:
    return [
        DiscoveryMethodMeta(
            name=group.name,
            variants=[
                DiscoveryVariant(
                    method_id=v.method_id,
                    resource_type=v.resource_type.label
                    if v.resource_type.label is not None
                    else v.resource_type.get_type(),
                    description=v.description,
                    input_schema=v.parameters_schema(),
                )
                for v in group.variants
            ],
        )
        for group in discovery_registry.list_groups()
    ]
