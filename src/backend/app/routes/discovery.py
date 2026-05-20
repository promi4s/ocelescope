from fastapi import APIRouter, HTTPException
from ocelescope.discovery import discovery_registry
from pydantic import ValidationError

from app.dependencies import ApiSession
from app.internal.model.discovery import (
    CreateDiscoveryTaskBody,
    DiscoveryMethodMeta,
    DiscoveryRequest,
    DiscoveryVariant,
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

    return DiscoveryTask.create_discovery_task(
        session=session,
        request=DiscoveryRequest(
            ocel_id=ocel_id,
            method_id=info.method_id,
            name=info.name,
            resource_type=info.resource_type.get_type(),
            parameters=parameters,
        ),
    )


@discovery_router.get(
    "/methods",
    summary="List discovery methods",
    operation_id="listDiscoveryMethods",
)
def list_discovery_methods() -> list[DiscoveryMethodMeta]:
    return [
        DiscoveryMethodMeta(
            name=group.name,
            description=group.description,
            input_schema=group.parameters_schema(),
            variants=[
                DiscoveryVariant(
                    method_id=v.method_id,
                    resource_type=v.resource_type.get_type(),
                )
                for v in group.variants
            ],
        )
        for group in discovery_registry.list_groups()
    ]
