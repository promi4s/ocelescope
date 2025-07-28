from __future__ import annotations
import io
import json
from typing import Optional


from fastapi.datastructures import UploadFile
from fastapi.exceptions import HTTPException
from fastapi.routing import APIRouter
from pydantic.main import BaseModel
from starlette.responses import StreamingResponse
from api.dependencies import ApiSession
from outputs.base import OutputApi
from outputs import output_registry
from outputs.vizualizations import Visualization


output_router = APIRouter(prefix="/outputs", tags=["outputs"])


@output_router.get(path="/", operation_id="outputs")
def get_outputs(session: ApiSession) -> list[OutputApi]:
    return [
        OutputApi(
            **output.model_dump(),
            type_label=output_registry.outputs[output.output.type].label,
        )
        for output in session.list_outputs()
    ]


@output_router.post("/", operation_id="uploadOutput")
async def upload_output(file: UploadFile, session: ApiSession):
    if file.content_type != "application/json":
        raise HTTPException(status_code=400, detail="Only JSON files are supported.")

    try:
        contents = await file.read()
        data = json.loads(contents)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file.")

    # Extract the 'type' field to determine the model
    output_type = data.get("type")
    if not output_type:
        raise HTTPException(status_code=400, detail="Missing 'type' field in JSON.")

    # Check if the type is registered
    if output_type not in output_registry.outputs:
        raise HTTPException(
            status_code=400, detail=f"Output type '{output_type}' is not registered."
        )

    # Get the model class and validate
    model_cls = output_registry.outputs[output_type].model_cls

    try:
        validated_instance = model_cls.model_validate(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Validation failed: {str(e)}")

    session.add_output(
        validated_instance,
        name=f"{file.filename}",  # type: ignore
    )


@output_router.get("/{output_id}/download")
def download_output(session: ApiSession, output_id: str):
    output = session.get_output(id=output_id)

    # Convert to JSON and wrap in a BytesIO stream
    json_bytes = io.BytesIO(
        json.dumps(output.output.model_dump(), indent=2).encode("utf-8")
    )

    return StreamingResponse(
        content=json_bytes,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={output.name}.json"},
    )


class GetOutputResponse(BaseModel):
    output: OutputApi
    visualization: Optional[Visualization]


@output_router.get(path="/{output_id}", operation_id="output")
def get_output(session: ApiSession, output_id: str) -> GetOutputResponse:
    output = session.get_output(output_id)

    return GetOutputResponse(
        output=OutputApi(
            **output.model_dump(),
            type_label=output_registry.outputs[output.output.type].label,
        ),
        visualization=output_registry.visualize(output=output.output),
    )


@output_router.delete(path="/{output_id}", operation_id="deleteOutput")
def delete_output(session: ApiSession, output_id: str):
    session.delete_output(output_id)


@output_router.post(path="/{output_id}", operation_id="renameOutputs")
def rename_output(session: ApiSession, output_id: str, new_name: str):
    session.rename_output(output_id, new_name)
