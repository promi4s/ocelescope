"""Object-centric summaries: types, counts, ids and activity-sequence variants."""

from __future__ import annotations

from fastapi import APIRouter
from ocelescope.ocel.constants.pm4py import OID_COL, OTYPE_COL
from ocelescope_backend.app.dependencies import ApiOCELDb
from ocelescope_backend.app.internal.model.base import PaginatedResponse

from ocelescope_module_ocel.models import ObjectTypeVariants
from ocelescope_module_ocel.util import variants as variant_util
from ocelescope_module_ocel.util.pagination import paginate_ids

router = APIRouter()


@router.get("/{ocel_id}/objects/types", operation_id="objectTypes")
def get_object_types(ocel_db: ApiOCELDb) -> list[str]:
    types = ocel_db.objects.project(f'"{OTYPE_COL}"').distinct().fetchall()
    return sorted(row[0] for row in types)


@router.get(
    "/{ocel_id}/objects/counts",
    response_model=dict[str, int],
    operation_id="objectCounts",
)
def get_object_counts(ocel_db: ApiOCELDb) -> dict[str, int]:
    counts = (
        ocel_db.objects.aggregate(
            f'"{OTYPE_COL}" AS type, count(*) AS count',
            group_expr=f'"{OTYPE_COL}"',
        )
        .order("count DESC")
        .fetchall()
    )
    return {type: int(count) for type, count in counts}


@router.get("/{ocel_id}/objects/ids", operation_id="objectIds")
def get_object_ids(
    ocel_db: ApiOCELDb,
    search: str | None = None,
    size: int = 10,
    page: int = 1,
) -> PaginatedResponse[list[str]]:
    return paginate_ids(ocel_db.objects, OID_COL, search, page, size)


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
def get_object_variants(ocel_db: ApiOCELDb, object_type: str) -> ObjectTypeVariants:
    return variant_util.object_type_variants(ocel_db, object_type)
