from datetime import datetime
from pathlib import Path
from typing import Annotated, Literal, Optional

import pandas as pd
from fastapi import APIRouter, Query, Response
from ocelescope.ocel.constants.misc import OCELFileExtensions

from ocelescope_backend.app.dependencies import ApiOcel, ApiSession
from ocelescope_backend.app.internal.exceptions import NotFound
from ocelescope_backend.app.internal.model.base import PaginatedResponse
from ocelescope_backend.app.internal.model.relations import (
    RelationCombination,
    RelationCountSummary,
)
from ocelescope_backend.app.internal.model.events import (
    Date_Distribution_Item,
    Entity_Time_Info,
)
from ocelescope_backend.app.internal.model.ocel import (
    AggregatedAttribute,
    OcelMetadata,
    QuantityInfo,
    TypedAttribute,
)
from ocelescope_backend.app.internal.model.response import TempFileResponse
from ocelescope_backend.app.internal.ocel.default_ocel import (
    DEFAULT_OCEL_KEYS,
    DefaultOCEL,
    filter_default_ocels,
    get_default_ocel,
)
from ocelescope_backend.app.internal.registry import registry_manager
from ocelescope_backend.app.internal.registry.extension import OCELExtensionDescription
from ocelescope_backend.app.internal.util.pandas import search_paginated_dataframe
from ocelescope_backend.app.internal.util.relations import (
    RelationSortField,
    relation_summary,
)

ocels_router = APIRouter(prefix="/ocels", tags=["ocels"])


# region Management
@ocels_router.get(
    "",
    summary="List uploaded and uploading OCELs",
    description=(
        "Returns metadata for all uploaded OCELs along with any OCEL files "
        "currently being imported. Includes the ID of the currently active OCEL, "
        "if one is selected."
    ),
    operation_id="getOcels",
)
def getOcels(
    session: ApiSession, extension_name: Optional[str] = None
) -> list[OcelMetadata]:
    return [
        OcelMetadata.from_ocel(
            value.ocel, filter_applied=len(value._applied_filter) > 0
        )
        for value in session.ocels.values()
        if extension_name is None
        or extension_name
        in [extension.__class__.__name__ for extension in value.ocel.extensions.all()]
    ]


@ocels_router.get(
    "/default", summary="Get default OCEL metadata", operation_id="getDefaultOcel"
)
def default_ocels(
    only_latest_versions: bool = True,
    only_preloaded: bool = False,
) -> list[DefaultOCEL]:
    filtered = filter_default_ocels(
        exclude_hidden=True,
        only_latest_versions=only_latest_versions,
        only_preloaded=only_preloaded,
    )
    return filtered


@ocels_router.post(
    "/default", summary="Import default OCEL", operation_id="importDefaultOcel"
)
def import_default_ocel(
    response: Response,
    session: ApiSession,
    key: str = Query(
        description="Default OCEL key",
        examples=DEFAULT_OCEL_KEYS,
    ),
    version: str | None = Query(
        default=None,
        description="Dataset version (optional)",
        examples=["1.0"],
    ),
) -> Response:
    default_ocel = get_default_ocel(key=key, version=version)
    if default_ocel is None:
        raise NotFound("The given default OCEL was not found")

    # Load OCEL
    ocel = default_ocel.get_ocel_copy(use_abbreviations=False)

    ocel.meta.extra = {"name": default_ocel.name, "upload_date": str(datetime.now())}

    session.add_ocel(ocel)
    response.status_code = 200

    return response


# endregion


# region Extension
@ocels_router.get("/extension/meta", operation_id="getExtensionMeta")
def get_extension_meta() -> dict[str, OCELExtensionDescription]:
    return registry_manager.get_extension_descriptions()


# endregion


# region Management
@ocels_router.get(
    "/{ocel_id}", summary="Get general information about a OCEL", operation_id="getOcel"
)
def get_ocel(ocel: ApiOcel, session: ApiSession) -> OcelMetadata:

    return OcelMetadata.from_ocel(
        ocel,
    )


@ocels_router.post(
    "/{ocel_id}/delete",
    summary="Delete an uploaded OCEL",
    description=(
        "Deletes the uploaded OCEL with the given `ocel_id`. "
        "This action is irreversible and removes the OCEL from the session."
    ),
    operation_id="deleteOcel",
)
def delete_ocel(session: ApiSession, ocel_id: str):
    session.delete_ocel(ocel_id)


@ocels_router.post(
    "/{ocel_id}/rename",
    summary="Rename an uploaded OCEL",
    description=(
        "Renames the OCEL represented by the given `ApiOcel` object to `new_name`. "
        "This updates the display name used in the UI and metadata."
    ),
    operation_id="renameOcel",
)
def rename_ocel(ocel: ApiOcel, new_name: str):
    ocel.meta.extra["name"] = new_name


# endregion
# region Info
@ocels_router.get(
    "/{ocel_id}/attributes",
    operation_id="AggregatedAttributes",
)
def get_aggr_object_attributes(
    ocel: ApiOcel,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query()] = 10,
    entity_type: Annotated[Literal["events", "objects"], Query()] = "events",
    attribute_names: Annotated[list[str] | None, Query()] = None,
    entity_names: Annotated[list[str] | None, Query()] = None,
) -> PaginatedResponse[list[AggregatedAttribute]]:
    attribute_names = (
        (
            ocel.events.attribute_names
            if entity_type == "events"
            else ocel.objects.attribute_names
        )
        if attribute_names is None
        else sorted(attribute_names)
    )

    attribute_summary = ocel.attributes.get_aggr_summary(
        activities=[] if entity_type == "objects" else entity_names,
        object_types=[] if entity_type == "events" else entity_names,
        attributes=attribute_names[(page - 1) * page_size : page * page_size],
    )

    return PaginatedResponse(
        page=page,
        total_items=len(attribute_names),
        response=AggregatedAttribute.from_df(attribute_summary),
        page_size=page_size,
    )


@ocels_router.get("/{ocel_id}/attribute/names", operation_id="AttributeNames")
def get_attribute_names(
    ocel: ApiOcel,
    entity_type: Annotated[Literal["events", "objects"] | None, Query()] = None,
) -> list[str]:

    attribute_names = []

    if entity_type != "events":
        attribute_names += ocel.objects.attribute_names

    if entity_type != "objects":
        attribute_names += ocel.events.attribute_names

    return attribute_names


@ocels_router.get(
    "/{ocel_id}/objects/attributes",
    response_model=list[TypedAttribute],
    operation_id="objectAttributes",
)
def get_object_attributes(
    ocel: ApiOcel,
    attribute_names: Annotated[list[str], Query()] = [],
    names: Annotated[list[str] | None, Query()] = None,
):
    return TypedAttribute.from_df(
        ocel.attributes.get_object_summary(
            attributes=None if len(attribute_names) == 0 else attribute_names,
            object_types=names,
        )
    )


@ocels_router.get(
    "/{ocel_id}/objects/types",
    operation_id="objectTypes",
)
def get_object_types(ocel: ApiOcel) -> list[str]:
    return ocel.objects.types


@ocels_router.get(
    "/{ocel_id}/events/attributes",
    response_model=list[TypedAttribute],
    operation_id="eventAttributes",
)
def get_event_attributes(
    ocel: ApiOcel,
    attribute_names: Annotated[list[str], Query()] = [],
    names: Annotated[list[str] | None, Query()] = None,
):
    return TypedAttribute.from_df(
        ocel.attributes.get_activity_summary(
            attributes=None if len(attribute_names) == 0 else attribute_names,
            activities=names,
        )
    )


@ocels_router.get(
    "/{ocel_id}/events/counts",
    response_model=dict[str, int],
    operation_id="eventCounts",
)
def get_event_counts(
    ocel: ApiOcel,
) -> dict[str, int]:
    return ocel.events.activity_counts.to_dict()


@ocels_router.get(
    "/{ocel_id}/events/activityNames",
    operation_id="Activities",
)
def get_activities(
    ocel: ApiOcel,
) -> list[str]:
    return ocel.events.activities


@ocels_router.get(
    "/{ocel_id}/events/time",
    response_model=Entity_Time_Info,
    operation_id="timeInfo",
)
def get_time_info(
    ocel: ApiOcel, periods: int | None = None, freq: str | None = None
) -> Entity_Time_Info:
    activity_timestamp = ocel.events.df[
        [ocel.ocel.event_timestamp, ocel.ocel.event_activity]
    ].reset_index(drop=True)
    timestamps = activity_timestamp[ocel.ocel.event_timestamp]
    start_time = timestamps.min()
    end_time = timestamps.max()

    bins = pd.date_range(start_time, end_time, periods=periods, freq=freq)

    activity_timestamp["window_id"] = pd.cut(
        timestamps,
        bins=bins,
        labels=False,
        include_lowest=True,
    )

    activity_timestamp = (
        activity_timestamp.groupby(["window_id", ocel.ocel.event_activity])
        .size()  # type:ignore
        .reset_index(name="count")
        .merge(
            pd.DataFrame(
                {"window_id": range(len(bins) - 1), "start": bins[:-1], "end": bins[1:]}
            ),
            on="window_id",
            how="left",
        )
    )

    date_distribution = [
        Date_Distribution_Item(
            start_timestamp=row["start"].isoformat(),
            end_timestamp=row["end"].isoformat(),
            entity_count=dict(zip(grp[ocel.ocel.event_activity], grp["count"])),
        )
        for _, grp in activity_timestamp.groupby("window_id")
        for row in [grp.iloc[0]]
    ]

    return Entity_Time_Info(
        start_time=start_time.isoformat(),
        end_time=end_time.isoformat(),
        date_distribution=date_distribution,
    )


@ocels_router.get(
    "/{ocel_id}/objects/counts",
    response_model=dict[str, int],
    operation_id="objectCounts",
)
def get_object_counts(
    ocel: ApiOcel,
) -> dict[str, int]:
    return ocel.objects.counts.to_dict()


@ocels_router.get(
    "/{ocel_id}/relations/e2o",
    operation_id="e2o",
)
def get_e2o(
    ocel: ApiOcel,
    direction: Literal["source", "target"] = "source",
    source_types: Annotated[list[str] | None, Query()] = None,
    target_types: Annotated[list[str] | None, Query()] = None,
    qualifiers: Annotated[list[str] | None, Query()] = None,
    sort_by: Annotated[RelationSortField | None, Query()] = None,
    order: Annotated[Literal["asc", "desc"], Query()] = "asc",
    page: Annotated[int | None, Query(ge=1)] = None,
    page_size: Annotated[int | None, Query(ge=1)] = None,
    with_qualifier: Annotated[bool, Query()] = True,
) -> PaginatedResponse[list[RelationCountSummary]]:
    return relation_summary(
        ocel.e2o,
        direction,
        source_types,
        target_types,
        qualifiers,
        sort_by,
        order,
        page,
        page_size,
        with_qualifier=with_qualifier,
    )


@ocels_router.get(
    "/{ocel_id}/relations/o2o",
    operation_id="o2o",
)
def get_object_relations(
    ocel: ApiOcel,
    direction: Literal["source", "target"] = "source",
    source_types: Annotated[list[str] | None, Query()] = None,
    target_types: Annotated[list[str] | None, Query()] = None,
    qualifiers: Annotated[list[str] | None, Query()] = None,
    sort_by: Annotated[RelationSortField | None, Query()] = None,
    order: Annotated[Literal["asc", "desc"], Query()] = "asc",
    page: Annotated[int | None, Query(ge=1)] = None,
    page_size: Annotated[int | None, Query(ge=1)] = None,
    with_qualifier: Annotated[bool, Query()] = True,
) -> PaginatedResponse[list[RelationCountSummary]]:
    return relation_summary(
        ocel.o2o,
        direction,
        source_types,
        target_types,
        qualifiers,
        sort_by,
        order,
        page,
        page_size,
        with_qualifier=with_qualifier,
    )


@ocels_router.get(
    "/{ocel_id}/relations/e2o/combinations",
    operation_id="e2oCombinations",
)
def get_e2o_combinations(
    ocel: ApiOcel,
    direction: Literal["source", "target"] = "source",
) -> list[RelationCombination]:
    return RelationCombination.from_combinations(
        ocel.e2o.combinations(direction, with_qualifier=True)
    )


@ocels_router.get(
    "/{ocel_id}/relations/o2o/combinations",
    operation_id="o2oCombinations",
)
def get_o2o_combinations(
    ocel: ApiOcel,
    direction: Literal["source", "target"] = "source",
) -> list[RelationCombination]:
    return RelationCombination.from_combinations(
        ocel.o2o.combinations(direction, with_qualifier=True)
    )


@ocels_router.get("/{ocel_id}/events/ids", operation_id="eventIds")
def get_event_ids(
    ocel: ApiOcel,
    search: str | None = None,
    size: int = 10,
    page: int = 1,
) -> PaginatedResponse[list[str]]:
    filtered_df = search_paginated_dataframe(
        df=ocel.events.df,
        page=page,
        page_size=size,
        query=search,
        search_column=ocel.ocel.event_id_column,
    )

    event_ids: list[str] = filtered_df[ocel.ocel.event_id_column].to_list()

    return PaginatedResponse(
        response=event_ids, page=page, page_size=size, total_items=len(ocel.events.df)
    )


@ocels_router.get("/{ocel_id}/objects/ids", operation_id="objectIds")
def get_object_ids(
    ocel: ApiOcel,
    search: str | None = None,
    size: int = 10,
    page: int = 1,
) -> PaginatedResponse[list[str]]:
    filtered_df = search_paginated_dataframe(
        df=ocel.objects.df,
        page=page,
        page_size=size,
        query=search,
        search_column=ocel.ocel.object_id_column,
    )

    object_ids: list[str] = filtered_df[ocel.ocel.object_id_column].to_list()

    return PaginatedResponse(
        response=object_ids, page=page, page_size=size, total_items=len(ocel.objects.df)
    )


# endregion


# region Quantities
@ocels_router.get("/{ocel_id}/quantity/info", operation_id="QuantityInfo")
def get_quantity_info(
    ocel: ApiOcel,
) -> QuantityInfo:
    return QuantityInfo.from_ocel(ocel)


# endregion
# region Export
@ocels_router.get(
    "/{ocel_id}/download",
    summary="Download OCEL",
    operation_id="downloadOCEL",
)
def download_ocel(
    ocel: ApiOcel,
    ext: OCELFileExtensions = ".json",
) -> TempFileResponse:
    name = ocel.meta.extra["name"]
    tmp_file_prefix = datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + name

    file_response = TempFileResponse(
        prefix=tmp_file_prefix, suffix=ext, filename=name + ext
    )

    ocel.write(Path(file_response.tmp_path))

    return file_response


@ocels_router.get(
    "/{ocel_id}/download/xes",
    summary="Download OCEL as a xes",
    operation_id="downloadFlatLog",
)
def download_flat_log(ocel: ApiOcel, object_type_name: str) -> TempFileResponse:
    name = ocel.meta.extra["name"]
    tmp_file_prefix = datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + name

    file_response = TempFileResponse(
        prefix=tmp_file_prefix,
        suffix=".xes",
        filename=f"{name}_{object_type_name}.xes",
    )

    ocel.write_xes(object_type_name, Path(file_response.tmp_path))

    return file_response


# endregion
