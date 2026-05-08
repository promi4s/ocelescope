from fastapi import APIRouter, HTTPException
from ocelescope.discovery import discovery_registry
from pydantic import ValidationError

from app.dependencies import ApiSession
from app.internal.model.discovery import (
    CreateDiscoveryTaskBody,
    DiscoveryMethodMeta,
    DiscoveryRequest,
)
from app.internal.tasks.discovery_task import DiscoveryTask

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
        algorithm = discovery_registry.get(body.method_id)
        parsed_parameters = algorithm.parse_parameters(body.parameters)
        parameters = algorithm.dump_parameters(parsed_parameters)
    except KeyError:
        raise HTTPException(
            status_code=404,
            detail=f"Discovery method '{body.method_id}' is not registered",
        )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc

    return DiscoveryTask.create_discovery_task(
        session=session,
        request=DiscoveryRequest(
            ocel_id=ocel_id,
            method_id=algorithm.method_id,
            name=algorithm.name,
            resource_type=algorithm.resource_type,
            parameters=parameters,
        ),
    )


@discovery_router.get(
    "/methods",
    summary="List discovery methods",
    operation_id="listDiscoveryMethods",
)
def list_discovery_methods() -> list[DiscoveryMethodMeta]:
    methods: list[DiscoveryMethodMeta] = []

    for algorithm in discovery_registry.list_algorithms():
        methods.append(
            DiscoveryMethodMeta(
                method_id=algorithm.method_id,
                resource_type=algorithm.resource_type,
                name=algorithm.name,
                description=algorithm.description,
                input_schema=algorithm.parameters_schema(),
            )
        )

    return methods
