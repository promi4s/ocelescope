"""OCEL lifecycle: list / inspect / import defaults / rename / delete."""

from __future__ import annotations

from fastapi import APIRouter, Query, Response
from ocelescope.ocel.io.connection import connect_target
from ocelescope_backend.app.dependencies import ApiSession
from ocelescope_backend.app.internal.exceptions import NotFound

from ocelescope import OCEL
from ocelescope_module_ocel.config import DefaultOCELs
from ocelescope_module_ocel.models import OcelMetadata, ViewMetadata
from ocelescope_module_ocel.models.default_ocel import DefaultOCEL

router = APIRouter()


# TODO: Fix this path issue
@router.get(
    "/ocels",
    summary="List uploaded and uploading OCELs",
    description=(
        "Returns metadata for all uploaded OCELs along with any OCEL files "
        "currently being imported."
    ),
    operation_id="getOcels",
)
def get_ocels(
    session: ApiSession,
) -> list[OcelMetadata]:
    return [
        OcelMetadata.from_handle(handle, filter_applied=handle.has_active_view)
        for handle in session.ocels.values()
    ]


@router.get(
    "/views",
    summary="List the named views",
    description="Returns the named views of all OCELs, or of `ocel_id` only.",
    operation_id="getViews",
)
def get_views(session: ApiSession, ocel_id: str | None = None) -> list[ViewMetadata]:
    handles = session.ocels.values() if ocel_id is None else [session.get_ocel(ocel_id)]
    return [
        ViewMetadata.from_view(view, active=handle.active_view_id == view.id)
        for handle in handles
        for view in handle.list_views()
    ]


@router.post(
    "/views/{view_id}/rename",
    summary="Rename a view",
    operation_id="renameView",
)
def rename_view(session: ApiSession, view_id: str, new_name: str):
    view = session.find_view(view_id)
    view.origin.rename_view(view.id, new_name)


@router.post(
    "/views/{view_id}/delete",
    summary="Delete a view",
    operation_id="deleteView",
)
def delete_view(session: ApiSession, view_id: str):
    view = session.find_view(view_id)
    view.origin.delete_view(view.id)


@router.get(
    "/default", summary="Get default OCEL metadata", operation_id="getDefaultOcel"
)
def default_ocels(default_config: DefaultOCELs) -> list[DefaultOCEL]:
    return default_config.event_logs if default_config else []


@router.post(
    "/default", summary="Import default OCEL", operation_id="importDefaultOcel"
)
def import_default_ocel(
    session: ApiSession,
    default_config: DefaultOCELs,
    key: str = Query(
        description="Default OCEL key",
    ),
    version: str | None = Query(
        default=None, description="Dataset version (optional)", examples=["1.0"]
    ),
) -> Response:
    if not default_config:
        raise NotFound("No default OCELs configured")

    event_log = default_config.get_event_log(key=key, version=version)
    if not event_log:
        raise NotFound("Default OCEL not found")

    event_log_path = default_config.event_log_directory / event_log.file
    if not event_log_path.exists():
        raise NotFound("Default OCEL file not found")

    with connect_target(event_log_path) as conn:
        session.add_ocel(OCEL.from_duckdb(conn), event_log.name)

    return Response(status_code=200)


@router.get(
    "/{ocel_id}",
    summary="Get general information about a OCEL",
    operation_id="getOcel",
)
def get_ocel(session: ApiSession, ocel_id: str) -> OcelMetadata:
    handle = session.get_ocel(ocel_id)
    return OcelMetadata.from_handle(handle, filter_applied=handle.has_active_view)


@router.post(
    "/{ocel_id}/delete",
    summary="Delete an uploaded OCEL",
    description="Deletes the uploaded OCEL with the given `ocel_id`.",
    operation_id="deleteOcel",
)
def delete_ocel(session: ApiSession, ocel_id: str):
    session.delete_ocel(ocel_id)


@router.post(
    "/{ocel_id}/rename",
    summary="Rename an uploaded OCEL",
    description="Renames the OCEL with the given `ocel_id` to `new_name`.",
    operation_id="renameOcel",
)
def rename_ocel(session: ApiSession, ocel_id: str, new_name: str):
    session.get_ocel(ocel_id).rename(new_name)
