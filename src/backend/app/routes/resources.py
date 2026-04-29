from __future__ import annotations

import json
from typing import Optional

from fastapi.datastructures import UploadFile
from fastapi.exceptions import HTTPException
from fastapi.routing import APIRouter
from ocelescope import Visualization
from pydantic.main import BaseModel

from app.dependencies import ApiSession
from app.internal.model.resource import ResourceApi, ResourceStore
from app.internal.model.response import TempFileResponse
from app.internal.registry import registry_manager
from app.internal.registry.registry_manager import ResourceInfo

resource_router = APIRouter(prefix="/resources", tags=["resources"])


@resource_router.get(path="", operation_id="resources")
def get_resources(
    session: ApiSession, resource_type: Optional[str] = None
) -> list[ResourceApi]:
    return [
        resource
        for resource in session.list_resources()
        if resource_type is None or resource.type == resource_type
    ]


@resource_router.get(path="/meta", operation_id="getResourceMeta")
def get_resource_meta() -> dict[str, ResourceInfo]:
    return registry_manager.get_resource_info()


@resource_router.post("", operation_id="uploadResource")
async def upload_resource(file: UploadFile, session: ApiSession):
    if file.content_type not in {"application/json", "application/octet-stream", None}:
        raise HTTPException(status_code=400, detail="Only JSON files are supported.")

    try:
        contents = await file.read()
        data = json.loads(contents)
        resource = ResourceStore(**data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON file.")

    session.add_resource(
        resource,
    )


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
        json.dump(resource.model_dump(), output_file, indent=2)

    return file_response


class GetResourceResponse(BaseModel):
    resource: ResourceApi
    visualization: Visualization | None


@resource_router.get(path="/resource/{resource_id}", operation_id="resource")
def get_resource(session: ApiSession, resource_id: str) -> GetResourceResponse:
    resource = session.get_resource(resource_id)

    resource_instance = registry_manager.get_resource_instance(resource)

    return GetResourceResponse(
        resource=ResourceApi(
            id=resource_id,
            **resource.model_dump(),
        ),
        visualization=resource_instance.visualize()
        if resource_instance is not None
        else None,
    )


@resource_router.delete(path="/resource/{resource_id}", operation_id="deleteResource")
def delete_resource(session: ApiSession, resource_id: str):
    session.delete_resource(resource_id)


@resource_router.post(path="/resource/{resource_id}", operation_id="renameResource")
def rename_resource(session: ApiSession, resource_id: str, new_name: str):
    session.rename_resource(resource_id, new_name)
