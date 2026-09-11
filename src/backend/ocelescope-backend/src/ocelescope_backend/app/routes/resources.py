from __future__ import annotations

import json
from typing import Optional, cast

from fastapi.exceptions import HTTPException
from fastapi.routing import APIRouter
from pydantic.main import BaseModel

from ocelescope import PetriNet, Visualization
from ocelescope_backend.app.dependencies import ApiSession
from ocelescope_backend.app.internal.model.resource import ResourceApi
from ocelescope_backend.app.internal.model.response import TempFileResponse
from ocelescope_backend.app.internal.registry import registry_manager
from ocelescope_backend.app.internal.registry.registry_manager import ResourceInfo

resource_router = APIRouter(prefix="/resources", tags=["resources"])


@resource_router.get(path="", operation_id="resources")
def get_resources(
    session: ApiSession, schema_hash: Optional[str] = None
) -> list[ResourceApi]:
    return [
        resource
        for resource in session.list_resources()
        if schema_hash is None or resource.schema_hash == schema_hash
    ]


@resource_router.get(path="/meta", operation_id="getResourceMeta")
def get_resource_meta() -> dict[str, ResourceInfo]:
    return registry_manager.get_resource_info()


@resource_router.get(
    "/resource/{resource_id}/download", operation_id="downloadResource"
)
def download_resource(session: ApiSession, resource_id: str) -> TempFileResponse:
    resource = session.get_resource(id=resource_id)

    file_response = TempFileResponse(
        prefix=resource.name,
        suffix=".ocelescope",
        filename=f"{resource.name}.ocelescope",
    )

    with open(file_response.tmp_path, "w", encoding="utf-8") as output_file:
        json.dump(resource.export(), output_file, indent=2)

    return file_response


@resource_router.get(
    "/resource/{resource_id}/download/pnml", operation_id="downloadResourceAsPnml"
)
def download_resource_as_pnml(
    session: ApiSession, resource_id: str
) -> TempFileResponse:
    import pm4py

    resource = session.get_resource(id=resource_id)
    resource_instance = registry_manager.get_resource_instance(
        resource.data, registry_manager._CORE_RESOURCE_NAMESPACE
    )

    if not isinstance(resource_instance, PetriNet):
        raise HTTPException(status_code=400, detail="Resource is not a Petri net.")

    pm4py_net, initial_marking, final_marking = resource_instance.to_pm4py()

    file_response = TempFileResponse(
        prefix=resource.name,
        suffix=".pnml",
        filename=f"{resource.name}.pnml",
    )
    pm4py.write_pnml(pm4py_net, initial_marking, final_marking, file_response.tmp_path)

    return file_response


class GetResourceResponse(BaseModel):
    resource: ResourceApi
    visualization: Visualization | None


@resource_router.get(path="/resource/{resource_id}", operation_id="resource")
def get_resource(session: ApiSession, resource_id: str) -> GetResourceResponse:
    resource = session.get_resource(resource_id)

    resource_instance = registry_manager.get_resource_instance(resource.data)

    return GetResourceResponse(
        resource=ResourceApi(
            id=resource_id,
            resource_type_label=resource_instance.get_label(),
            **resource.model_dump(),
        ),
        visualization=cast(Visualization, resource_instance.visualize())
        if resource_instance is not None
        else None,
    )


@resource_router.delete(path="/resource/{resource_id}", operation_id="deleteResource")
def delete_resource(session: ApiSession, resource_id: str):
    session.delete_resource(resource_id)


@resource_router.post(path="/resource/{resource_id}", operation_id="renameResource")
def rename_resource(session: ApiSession, resource_id: str, new_name: str):
    session.rename_resource(resource_id, new_name)
