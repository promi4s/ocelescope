"""The log summaries, for the log as a draft pipeline's first steps leave it.

Every route takes the steps as its body -- the filters before the one being
edited -- and answers like the OCEL module's route of the same name does for a
stored log. The preview is a view built for the request; nothing is stored.
"""

from __future__ import annotations

from typing import Annotated

import duckdb
from fastapi import APIRouter, Body, Query
from ocelescope_backend.app.dependencies import ApiSession
from ocelescope_backend.app.internal.exceptions import BadRequest
from ocelescope_backend.app.internal.model.base import PaginatedResponse
from ocelescope_module_ocel.models import (
    AggregatedAttribute,
    AttributeDistribution,
    AttributeMatches,
    Entity_Time_Info,
    RelationCombination,
    RelationCountDistribution,
    RelationCountSummary,
    TypedAttribute,
)
from ocelescope_module_ocel.util import attributes, events, relations
from ocelescope_module_ocel.util.attributes import EntityType
from ocelescope_module_ocel.util.pagination import paginate_list
from ocelescope_module_ocel.util.relations import Direction, RelationKind

from ocelescope_module_filter.filters import NativeFilter
from ocelescope_module_filter.preview.view import preview

router = APIRouter(prefix="/{ocel_id}/preview")

Steps = Annotated[list[NativeFilter], Body()]


@router.post("/events/counts", operation_id="previewEventCounts")
def preview_event_counts(
    ocel_id: str, session: ApiSession, steps: Steps
) -> dict[str, int]:
    with preview(session, ocel_id, steps) as view:
        return events.event_counts(view)


@router.post("/objects/counts", operation_id="previewObjectCounts")
def preview_object_counts(
    ocel_id: str, session: ApiSession, steps: Steps
) -> dict[str, int]:
    with preview(session, ocel_id, steps) as view:
        return events.object_counts(view)


@router.post("/events/time", operation_id="previewTimeInfo")
def preview_time_info(
    ocel_id: str,
    session: ApiSession,
    steps: Steps,
    periods: int | None = None,
    freq: str | None = None,
) -> Entity_Time_Info:
    with preview(session, ocel_id, steps) as view:
        return events.time_info(view, periods, freq)


@router.post("/attributes/names", operation_id="previewAttributeNames")
def preview_attribute_names(
    ocel_id: str,
    session: ApiSession,
    steps: Steps,
    entity_type: Annotated[EntityType | None, Query()] = None,
) -> list[str]:
    with preview(session, ocel_id, steps) as view:
        names: list[str] = []
        if entity_type != "events":
            names += attributes.attribute_names(view, "objects")
        if entity_type != "objects":
            names += attributes.attribute_names(view, "events")
        return names


@router.post("/attributes", operation_id="previewAggregatedAttributes")
def preview_aggregated_attributes(
    ocel_id: str,
    session: ApiSession,
    steps: Steps,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query()] = 10,
    entity_type: Annotated[EntityType, Query()] = "events",
    attribute_names: Annotated[list[str] | None, Query()] = None,
    entity_names: Annotated[list[str] | None, Query()] = None,
    drop_constant: Annotated[bool, Query()] = False,
) -> PaginatedResponse[list[AggregatedAttribute]]:
    with preview(session, ocel_id, steps) as view:
        names = attributes.attribute_names(
            view, entity_type, attribute_names, entity_names, drop_constant
        )
        return PaginatedResponse(
            page=page,
            page_size=page_size,
            total_items=len(names),
            response=attributes.aggregate_attributes(
                view,
                entity_type,
                names[(page - 1) * page_size : page * page_size],
                entity_names,
            ),
        )


@router.post("/attributes/distribution", operation_id="previewAttributeDistribution")
def preview_attribute_distribution(
    ocel_id: str,
    session: ApiSession,
    steps: Steps,
    attribute: Annotated[str, Query()],
    entity_type: Annotated[EntityType, Query()] = "events",
    entity_names: Annotated[list[str] | None, Query()] = None,
    bins: Annotated[int, Query(ge=1, le=500)] = 50,
) -> AttributeDistribution | None:
    with preview(session, ocel_id, steps) as view:
        return attributes.attribute_distribution(
            view, entity_type, attribute, entity_names, bins
        )


@router.post("/attributes/values", operation_id="previewAttributeValues")
def preview_attribute_values(
    ocel_id: str,
    session: ApiSession,
    steps: Steps,
    attribute: Annotated[str, Query()],
    entity_type: Annotated[EntityType, Query()] = "events",
    entity_names: Annotated[list[str] | None, Query()] = None,
    regex: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
    values: Annotated[list[str] | None, Query()] = None,
) -> AttributeMatches:
    with preview(session, ocel_id, steps) as view:
        try:
            return attributes.attribute_values(
                view, entity_type, attribute, entity_names, regex, search, values
            )
        except duckdb.InvalidInputException as error:
            raise BadRequest(str(error)) from error


@router.post("/attributes/typed", operation_id="previewTypedAttributes")
def preview_typed_attributes(
    ocel_id: str,
    session: ApiSession,
    steps: Steps,
    attribute_names: Annotated[list[str], Query(default_factory=list)],
    entity_type: Annotated[EntityType, Query()] = "events",
    names: Annotated[list[str] | None, Query()] = None,
) -> list[TypedAttribute]:
    with preview(session, ocel_id, steps) as view:
        return attributes.typed_attributes(
            view, entity_type, attribute_names or None, names
        )


@router.post("/relations/{kind}", operation_id="previewRelations")
def preview_relations(
    ocel_id: str,
    kind: RelationKind,
    session: ApiSession,
    steps: Steps,
    direction: Direction = "source",
    source_types: Annotated[list[str] | None, Query()] = None,
    target_types: Annotated[list[str] | None, Query()] = None,
    qualifiers: Annotated[list[str] | None, Query()] = None,
    page: Annotated[int | None, Query(ge=1)] = None,
    page_size: Annotated[int | None, Query(ge=1)] = None,
    with_qualifier: Annotated[bool, Query()] = True,
    drop_constant: Annotated[bool, Query()] = False,
) -> PaginatedResponse[list[RelationCountSummary]]:
    with preview(session, ocel_id, steps) as view:
        summaries = relations.relation_summary(
            view,
            kind,
            direction,
            source_types,
            target_types,
            qualifiers,
            with_qualifier=with_qualifier,
            drop_constant=drop_constant,
        )
    return paginate_list(summaries, page, page_size)


@router.post(
    "/relations/{kind}/combinations", operation_id="previewRelationCombinations"
)
def preview_relation_combinations(
    ocel_id: str,
    kind: RelationKind,
    session: ApiSession,
    steps: Steps,
    direction: Direction = "source",
) -> list[RelationCombination]:
    with preview(session, ocel_id, steps) as view:
        return relations.combinations(view, kind, direction)


@router.post(
    "/relations/{kind}/distribution", operation_id="previewRelationCountDistribution"
)
def preview_relation_count_distribution(
    ocel_id: str,
    kind: RelationKind,
    session: ApiSession,
    steps: Steps,
    source: Annotated[str, Query()],
    target: Annotated[str, Query()],
    direction: Direction = "source",
    qualifier: Annotated[str | None, Query()] = None,
    bins: Annotated[int, Query(ge=1, le=500)] = 50,
) -> RelationCountDistribution:
    with preview(session, ocel_id, steps) as view:
        return relations.count_distribution(
            view, kind, source, target, direction, qualifier, bins
        )
