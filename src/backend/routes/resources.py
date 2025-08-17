from __future__ import annotations
import io
import json
from typing import Optional


from fastapi.datastructures import UploadFile
from fastapi.exceptions import HTTPException
from fastapi.routing import APIRouter
from ocelescope import Visualization
from pydantic.main import BaseModel
from starlette.responses import StreamingResponse
from api.dependencies import ApiSession

from registry import resource_registry
from api.model.resource import ResourceApi

resource_router = APIRouter(prefix="/resources", tags=["resources"])


@resource_router.get(path="/", operation_id="resources")
def get_resources(
    session: ApiSession, resource_type: Optional[str] = None
) -> list[ResourceApi]:
    return [
        ResourceApi(
            **resource.model_dump(),
            type_label=resource_registry.resources[resource.resource.type].label,
        )
        for resource in session.list_resources()
        if resource_type is None or resource.resource.type == resource_type
    ]


@resource_router.post("/", operation_id="uploadResource")
async def upload_resource(file: UploadFile, session: ApiSession):
    if file.content_type != "application/json":
        raise HTTPException(status_code=400, detail="Only JSON files are supported.")

    try:
        contents = await file.read()
        data = json.loads(contents)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file.")

    # Extract the 'type' field to determine the model
    resource_type = data.get("type")
    if not resource_type:
        raise HTTPException(status_code=400, detail="Missing 'type' field in JSON.")

    # Check if the type is registered
    if resource_type not in resource_registry.resources:
        raise HTTPException(
            status_code=400,
            detail=f"Resource type '{resource_type}' is not registered.",
        )

    # Get the model class and validate
    model_cls = resource_registry.resources[resource_type].model_cls

    try:
        validated_instance = model_cls.model_validate(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Validation failed: {str(e)}")

    session.add_resource(
        validated_instance,
        name=f"{file.filename}",  # type: ignore
    )


@resource_router.get("/{resource_id}/download")
def download_output(session: ApiSession, resource_id: str):
    resource = session.get_resource(id=resource_id)

    # Convert to JSON and wrap in a BytesIO stream
    json_bytes = io.BytesIO(
        json.dumps(resource.resource.model_dump(), indent=2).encode("utf-8")
    )

    return StreamingResponse(
        content=json_bytes,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={resource.name}.json"},
    )


class GetResourceResponse(BaseModel):
    resource: ResourceApi
    visualization: Visualization | None


@resource_router.get(path="/{resource_id}", operation_id="resource")
def get_resource(session: ApiSession, resource_id: str) -> GetResourceResponse:
    resource = session.get_resource(resource_id)

    return GetResourceResponse(
        resource=ResourceApi(
            **resource.model_dump(),
            type_label=resource_registry.resources[resource.resource.type].label,
        ),
        visualization=resource.resource.visualize(),
    )


@resource_router.delete(path="/{resource_id}", operation_id="deleteResource")
def delete_resource(session: ApiSession, resource_id: str):
    session.delete_resource(resource_id)


@resource_router.post(path="/{output_id}", operation_id="renameResource")
def rename_resource(session: ApiSession, output_id: str, new_name: str):
    session.rename_resource(output_id, new_name)
