from __future__ import annotations

from typing import Annotated, Any, cast

from fastapi import Query
from fastapi.routing import APIRouter
from pydantic import TypeAdapter, ValidationError

from ocelescope import PetriNet, TabularResource, Visualization
from ocelescope_backend.app.dependencies import ApiSession
from ocelescope_backend.app.internal.exceptions import BadRequest
from ocelescope_backend.app.internal.model.base import PaginatedResponse
from ocelescope_backend.app.internal.model.resource import (
    ResourceApi,
    ResourceTable,
    ResourceTypeInfo,
)
from ocelescope_backend.app.internal.model.response import TempFileResponse
from ocelescope_backend.app.internal.registry import resource_registry
from ocelescope_backend.app.internal.util.tabular import (
    as_tabular,
    column_values,
    query_table,
)

resource_router = APIRouter(prefix="/resources", tags=["resources"])

TABLE_FILTERS = TypeAdapter(dict[str, list[str]])


@resource_router.get(path="", operation_id="resources")
def get_resources(
    session: ApiSession, schema_hash: str | None = None
) -> list[ResourceApi]:
    return [
        resource
        for resource in session.list_resources()
        if schema_hash is None or resource.schema_hash == schema_hash
    ]


@resource_router.get(path="/meta", operation_id="getResourceMeta")
def get_resource_meta() -> dict[str, ResourceTypeInfo]:
    return {
        schema_hash: ResourceTypeInfo.from_resource_type(resource_type)
        for schema_hash, resource_type in resource_registry.resource_types().items()
    }


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

    with session.open_resource(resource_id) as resource_instance:
        resource_instance.write(file_response.tmp_path)

    return file_response


@resource_router.get(
    "/resource/{resource_id}/download/pnml", operation_id="downloadResourceAsPnml"
)
def download_resource_as_pnml(
    session: ApiSession, resource_id: str
) -> TempFileResponse:
    import pm4py

    resource = session.get_resource(id=resource_id)
    with session.open_resource(resource_id, PetriNet) as petri_net:
        pm4py_net, initial_marking, final_marking = petri_net.to_pm4py()

    file_response = TempFileResponse(
        prefix=resource.name,
        suffix=".pnml",
        filename=f"{resource.name}.pnml",
    )
    pm4py.write_pnml(pm4py_net, initial_marking, final_marking, file_response.tmp_path)

    return file_response


@resource_router.get(
    path="/resource/{resource_id}/tables", operation_id="resourceTables"
)
def get_resource_tables(session: ApiSession, resource_id: str) -> list[ResourceTable]:
    resource = session.get_resource(resource_id)
    resource_type = resource_registry.get_resource_class(resource.schema_hash)

    if not issubclass(resource_type, TabularResource):
        raise BadRequest("Resource is not tabular.")

    return ResourceTable.from_resource_type(resource_type)


@resource_router.get(
    path="/resource/{resource_id}/tables/{table_name}",
    operation_id="resourceTableRows",
)
def get_resource_table_rows(
    session: ApiSession,
    resource_id: str,
    table_name: str,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=500)] = 20,
    sort_by: str | None = None,
    descending: bool = False,
    filters: str | None = None,
) -> PaginatedResponse[list[dict[str, Any]]]:
    try:
        parsed_filters = TABLE_FILTERS.validate_json(filters) if filters else None
    except ValidationError as error:
        raise BadRequest("Invalid table filters.") from error

    with session.open_resource(resource_id) as resource:
        return query_table(
            as_tabular(resource),
            table_name,
            page=page,
            size=size,
            sort_by=sort_by,
            descending=descending,
            filters=parsed_filters,
        )


@resource_router.get(
    path="/resource/{resource_id}/tables/{table_name}/columns/{column_name}/values",
    operation_id="resourceTableColumnValues",
)
def get_resource_table_column_values(
    session: ApiSession,
    resource_id: str,
    table_name: str,
    column_name: str,
    search: str | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=500)] = 50,
) -> PaginatedResponse[list[str]]:
    with session.open_resource(resource_id) as resource:
        return column_values(
            as_tabular(resource),
            table_name,
            column_name,
            page=page,
            size=size,
            search=search,
        )


@resource_router.get(
    path="/resource/{resource_id}/visualization", operation_id="resourceVisualization"
)
def get_resource_visualization(
    session: ApiSession, resource_id: str
) -> Visualization | None:
    with session.open_resource(resource_id) as resource:
        return cast(Visualization | None, resource.visualize())


@resource_router.get(path="/resource/{resource_id}", operation_id="resource")
def get_resource(session: ApiSession, resource_id: str) -> ResourceApi:
    resource = session.get_resource(resource_id)
    resource_type = resource_registry.get_resource_class(resource.schema_hash)

    return ResourceApi.from_store(resource_id, resource, resource_type)


@resource_router.delete(path="/resource/{resource_id}", operation_id="deleteResource")
def delete_resource(session: ApiSession, resource_id: str):
    session.delete_resource(resource_id)


@resource_router.post(path="/resource/{resource_id}", operation_id="renameResource")
def rename_resource(session: ApiSession, resource_id: str, new_name: str):
    session.rename_resource(resource_id, new_name)
