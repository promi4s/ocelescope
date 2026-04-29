from collections.abc import Mapping

from fastapi import APIRouter

from app.dependencies import ApiSession
from app.internal.model.discovery import (
    DiscoverDFGBody,
    DiscoveryMethodMeta,
    DiscoverPetriNetBody,
    DiscoveryRequest,
    DiscoveryResourceType,
)
from app.internal.registry import registry_manager
from app.internal.tasks.discovery_task import DiscoveryTask

discovery_router = APIRouter(prefix="/ocels/{ocel_id}/discover", tags=["ocels"])
discovery_meta_router = APIRouter(prefix="/discovery", tags=["ocels"])


DISCOVERY_MODELS: Mapping[
    DiscoveryResourceType, type[DiscoverPetriNetBody] | type[DiscoverDFGBody]
] = {
    "PetriNet": DiscoverPetriNetBody,
    "DirectlyFollowsGraph": DiscoverDFGBody,
}


def _create_discovery_task(
    *,
    session: ApiSession,
    ocel_id: str,
    resource_type: DiscoveryResourceType,
    parameters: dict[str, object],
) -> str:
    return DiscoveryTask.create_discovery_task(
        session=session,
        request=DiscoveryRequest(
            ocel_id=ocel_id,
            resource_type=resource_type,
            parameters=parameters,
        ),
    )


@discovery_router.post(
    "/petri-net",
    summary="Discover an object-centric Petri net",
    operation_id="discoverPetriNet",
)
def discover_petri_net(
    session: ApiSession,
    ocel_id: str,
    body: DiscoverPetriNetBody,
) -> str:
    return _create_discovery_task(
        session=session,
        ocel_id=ocel_id,
        resource_type="PetriNet",
        parameters={
            "variant": body.variant,
            "excluded_event_types": body.excluded_event_types,
            "excluded_object_types": body.excluded_object_types,
            "activity_frequency_threshold": body.activity_frequency_threshold,
            "object_frequency_threshold": body.object_frequency_threshold,
        },
    )


@discovery_router.post(
    "/directly-follows-graph",
    summary="Discover an object-centric directly follows graph",
    operation_id="discoverDirectlyFollowsGraph",
)
def discover_directly_follows_graph(
    session: ApiSession,
    ocel_id: str,
    body: DiscoverDFGBody,
) -> str:
    return _create_discovery_task(
        session=session,
        ocel_id=ocel_id,
        resource_type="DirectlyFollowsGraph",
        parameters={
            "excluded_event_types": body.excluded_event_types,
            "excluded_object_types": body.excluded_object_types,
            "activity_frequency_threshold": body.activity_frequency_threshold,
            "object_frequency_threshold": body.object_frequency_threshold,
        },
    )


@discovery_meta_router.get(
    "/meta",
    summary="Get discovery method metadata",
    operation_id="getDiscoveryMeta",
)
def get_discovery_meta() -> list[DiscoveryMethodMeta]:
    methods: list[DiscoveryMethodMeta] = []

    for resource_type, input_model in DISCOVERY_MODELS.items():
        resource_class = registry_manager.get_resource_class(resource_type)
        methods.append(
            DiscoveryMethodMeta(
                resource_type=resource_type,
                label=resource_class.label or resource_type
                if resource_class is not None
                else resource_type,
                description=resource_class.description if resource_class else None,
                input_schema=input_model.model_json_schema(by_alias=True),
            )
        )

    return methods
