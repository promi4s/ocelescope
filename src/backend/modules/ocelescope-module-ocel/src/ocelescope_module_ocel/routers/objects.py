"""Object-centric summaries: types, counts, ids and activity-sequence variants."""

from __future__ import annotations

from fastapi import APIRouter
from ocelescope.ocel.constants.pm4py import OID_COL
from ocelescope_backend.app.dependencies import ApiOcel
from ocelescope_backend.app.internal.model.base import PaginatedResponse

from ocelescope_module_ocel.models import ObjectTypeVariants
from ocelescope_module_ocel.util import variants as variant_util
from ocelescope_module_ocel.util.pagination import paginate_ids

router = APIRouter()


@router.get("/{ocel_id}/objects/types", operation_id="objectTypes")
def get_object_types(ocel: ApiOcel) -> list[str]:
    return ocel.objects.types


@router.get(
    "/{ocel_id}/objects/counts",
    response_model=dict[str, int],
    operation_id="objectCounts",
)
def get_object_counts(ocel: ApiOcel) -> dict[str, int]:
    # Ordered most frequent first, which the response preserves.
    return {str(object_type): int(count) for object_type, count in ocel.objects.counts.items()}


@router.get("/{ocel_id}/objects/ids", operation_id="objectIds")
def get_object_ids(
    ocel: ApiOcel,
    search: str | None = None,
    size: int = 10,
    page: int = 1,
) -> PaginatedResponse[list[str]]:
    return paginate_ids(ocel.objects.table, OID_COL, search, page, size)


@router.get(
    "/{ocel_id}/objects/variants",
    summary="Get the variants of an object type",
    description=(
        "Returns the object variants for a single object type. Each variant is a "
        "distinct activity sequence, together with the number of events it contains "
        "and the number of cases (objects) that follow it."
    ),
    operation_id="objectVariants",
)
def get_object_variants(ocel: ApiOcel, object_type: str) -> ObjectTypeVariants:
    return variant_util.object_type_variants(ocel, object_type)
