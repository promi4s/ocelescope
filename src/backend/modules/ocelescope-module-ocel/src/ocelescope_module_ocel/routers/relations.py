"""E2O / O2O relation-count summaries and combinations, computed in DuckDB."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query
from ocelescope_backend.app.dependencies import ApiOcel
from ocelescope_backend.app.internal.model.base import PaginatedResponse

from ocelescope_module_ocel.models import RelationCombination, RelationCountSummary
from ocelescope_module_ocel.util import relations as relation_util
from ocelescope_module_ocel.util.relations import Direction

router = APIRouter()


@router.get("/{ocel_id}/relations/e2o", operation_id="e2o")
def get_e2o(
    ocel: ApiOcel,
    direction: Direction = "source",
    source_types: Annotated[list[str] | None, Query()] = None,
    target_types: Annotated[list[str] | None, Query()] = None,
    qualifiers: Annotated[list[str] | None, Query()] = None,
    page: Annotated[int | None, Query(ge=1)] = None,
    page_size: Annotated[int | None, Query(ge=1)] = None,
    with_qualifier: Annotated[bool, Query()] = True,
    drop_constant: Annotated[bool, Query()] = False,
) -> PaginatedResponse[list[RelationCountSummary]]:
    return relation_util.relation_summary(
        ocel,
        "e2o",
        direction,
        source_types,
        target_types,
        qualifiers,
        with_qualifier=with_qualifier,
        drop_constant=drop_constant,
        page=page,
        page_size=page_size,
    )


@router.get("/{ocel_id}/relations/o2o", operation_id="o2o")
def get_o2o(
    ocel: ApiOcel,
    direction: Direction = "source",
    source_types: Annotated[list[str] | None, Query()] = None,
    target_types: Annotated[list[str] | None, Query()] = None,
    qualifiers: Annotated[list[str] | None, Query()] = None,
    page: Annotated[int | None, Query(ge=1)] = None,
    page_size: Annotated[int | None, Query(ge=1)] = None,
    with_qualifier: Annotated[bool, Query()] = True,
    drop_constant: Annotated[bool, Query()] = False,
) -> PaginatedResponse[list[RelationCountSummary]]:
    return relation_util.relation_summary(
        ocel,
        "o2o",
        direction,
        source_types,
        target_types,
        qualifiers,
        with_qualifier=with_qualifier,
        drop_constant=drop_constant,
        page=page,
        page_size=page_size,
    )


@router.get("/{ocel_id}/relations/e2o/combinations", operation_id="e2oCombinations")
def get_e2o_combinations(
    ocel: ApiOcel,
    direction: Direction = "source",
) -> list[RelationCombination]:
    return relation_util.combinations(ocel, "e2o", direction)


@router.get("/{ocel_id}/relations/o2o/combinations", operation_id="o2oCombinations")
def get_o2o_combinations(
    ocel: ApiOcel,
    direction: Direction = "source",
) -> list[RelationCombination]:
    return relation_util.combinations(ocel, "o2o", direction)
