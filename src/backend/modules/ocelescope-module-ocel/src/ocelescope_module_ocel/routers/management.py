"""OCEL lifecycle: list / inspect / import defaults / rename / delete."""

from __future__ import annotations

from fastapi import APIRouter, Query, Response
from ocelescope.ocel.io.connection import connect_target
from ocelescope_backend.app.dependencies import ApiSession
from ocelescope_backend.app.internal.exceptions import NotFound

from ocelescope import OCEL
from ocelescope_module_ocel.config import DefaultOCELs
from ocelescope_module_ocel.models import OcelMetadata
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
        OcelMetadata.from_handle(handle, filter_applied=handle.is_filtered)
        for handle in session.ocels.values()
    ]


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
    if ocel_id not in session.ocels:
        raise NotFound("OCEL not found")

    handle = session.ocels[ocel_id]
    return OcelMetadata.from_handle(handle, filter_applied=handle.is_filtered)


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
    session.rename_ocel(ocel_id, new_name)
