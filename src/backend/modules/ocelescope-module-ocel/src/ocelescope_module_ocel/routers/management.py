"""OCEL lifecycle: list / inspect / import defaults / rename / delete."""

from __future__ import annotations

from fastapi import APIRouter, Query, Response
from ocelescope_backend.app.dependencies import ApiSession
from ocelescope_backend.app.internal.exceptions import NotFound
from ocelescope_backend.app.internal.ocel.default_ocel import (
    DEFAULT_OCEL_KEYS,
    DefaultOCEL,
    filter_default_ocels,
    get_default_ocel,
)

from ocelescope_module_ocel.models import OcelMetadata

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
def default_ocels(
    only_latest_versions: bool = True,
    only_preloaded: bool = False,
) -> list[DefaultOCEL]:
    return filter_default_ocels(
        exclude_hidden=True,
        only_latest_versions=only_latest_versions,
        only_preloaded=only_preloaded,
    )


@router.post(
    "/default", summary="Import default OCEL", operation_id="importDefaultOcel"
)
def import_default_ocel(
    response: Response,
    session: ApiSession,
    key: str = Query(description="Default OCEL key", examples=DEFAULT_OCEL_KEYS),
    version: str | None = Query(
        default=None, description="Dataset version (optional)", examples=["1.0"]
    ),
) -> Response:
    default_ocel = get_default_ocel(key=key, version=version)
    if default_ocel is None:
        raise NotFound("The given default OCEL was not found")

    with default_ocel.get_ocel_copy(use_abbreviations=False) as ocel:
        session.add_ocel(ocel, name=default_ocel.name)
    response.status_code = 200
    return response


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
