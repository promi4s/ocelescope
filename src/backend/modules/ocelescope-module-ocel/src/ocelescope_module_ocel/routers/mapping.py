from __future__ import annotations

from fastapi import APIRouter
from ocelescope_backend.app.dependencies import ApiOcel, ApiSession
from ocelescope_backend.app.internal.exceptions import BadRequest

from ocelescope import OCELMapping
from ocelescope_module_ocel.models.mapping import OcelMappingRequest

router = APIRouter()


@router.post(
    "/{ocel_id}/mapping",
    summary="Create an OCEL mapping from the OCEL",
    operation_id="createOcelMapping",
)
def create_ocel_mapping(
    session: ApiSession, ocel: ApiOcel, request: OcelMappingRequest
) -> str:
    if not (request.events or request.objects or request.e2o or request.o2o):
        raise BadRequest("Select at least one table for the mapping.")

    mapping = OCELMapping.from_ocel(
        ocel,
        events=request.events is not None,
        event_attributes=request.events.attributes if request.events else (),
        objects=request.objects is not None,
        object_attributes=request.objects.attributes if request.objects else (),
        e2o=request.e2o,
        o2o=request.o2o,
    )
    return session.add_resource(mapping, request.name)
