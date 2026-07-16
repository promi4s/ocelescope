"""Download the OCEL, or a flattened XES log.

``downloadOCEL`` streams the log straight from the DuckDB store (no materialization).
The two XES routes flatten a chosen object type into a per-object trace log, which
is pm4py-only, so those do pull the tables they need into memory.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Annotated, Literal

import polars as pl
from fastapi import APIRouter, Query
from ocelescope.ocel import Keep
from ocelescope.ocel.constants.misc import OCELFileExtensions
from ocelescope.ocel.constants.pm4py import OID_COL
from ocelescope_backend.app.dependencies import ApiOcel, ApiSession
from ocelescope_backend.app.internal.exceptions import NotFound
from ocelescope_backend.app.internal.model.response import TempFileResponse

from ocelescope import OCEL, BaseFilter
from ocelescope_module_ocel.util import variants as variant_util

router = APIRouter()


class _ObjectIdKeep(BaseFilter):
    """A ModuleFilter that keeps only the given object ids (for a variant sub-log)."""

    object_ids: list[str]

    def keep(self, ocel: OCEL) -> Keep:
        return Keep(objects=pl.LazyFrame({OID_COL: self.object_ids}))


@router.get("/{ocel_id}/download", summary="Download OCEL", operation_id="downloadOCEL")
def download_ocel(
    session: ApiSession,
    ocel_id: str,
    ext: OCELFileExtensions = ".json",
    ocel_version: Literal["original", "filtered"] | None = "filtered",
) -> TempFileResponse:
    if ocel_id not in session.ocels:
        raise NotFound("OCEL not found")

    name = session.ocels[ocel_id].name
    tmp_file_prefix = datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + name
    file_response = TempFileResponse(
        prefix=tmp_file_prefix, suffix=ext, filename=name + ext
    )

    session.export_ocel(
        ocel_id, Path(file_response.tmp_path), use_original=ocel_version == "original"
    )
    return file_response


@router.get(
    "/{ocel_id}/download/xes",
    summary="Download OCEL as a xes",
    operation_id="downloadFlatLog",
)
def download_flat_log(
    ocel: ApiOcel, ocel_id: str, session: ApiSession, object_type_name: str
) -> TempFileResponse:
    name = session.ocels[ocel_id].name
    tmp_file_prefix = f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-{name}"
    file_response = TempFileResponse(
        prefix=tmp_file_prefix, suffix=".xes", filename=f"{name}_{object_type_name}.xes"
    )

    ocel.write_xes(object_type_name, Path(file_response.tmp_path))
    return file_response


@router.get(
    "/{ocel_id}/objects/variants/download/xes",
    summary="Download selected object variants as a flat XES log",
    description=(
        "Filters the OCEL to the objects of `object_type` that follow any of the "
        "given `variant_ids`, then flattens that sub-log by `object_type` into a "
        "XES file (one trace per object)."
    ),
    operation_id="downloadVariantFlatLog",
)
def download_variant_flat_log(
    ocel: ApiOcel,
    session: ApiSession,
    ocel_id: str,
    object_type: str,
    variant_ids: Annotated[list[str], Query(min_length=1)],
) -> TempFileResponse:
    name = session.ocels[ocel_id].name
    object_ids = variant_util.object_ids_for_variants(ocel, object_type, variant_ids)
    if not object_ids:
        raise NotFound("No objects were found for the given variants")

    tmp_file_prefix = datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + name
    file_response = TempFileResponse(
        prefix=tmp_file_prefix, suffix=".xes", filename=f"{name}_{object_type}.xes"
    )

    with ocel.filter([_ObjectIdKeep(object_ids=object_ids)]) as variant_ocel:
        variant_ocel.write_xes(object_type, Path(file_response.tmp_path))
    return file_response
