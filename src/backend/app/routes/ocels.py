from datetime import datetime
from pathlib import Path
from typing import Annotated, Literal, Optional

import pandas as pd
from fastapi import APIRouter, Query, Response
from ocelescope import RelationCountSummary
from ocelescope.ocel.constants.misc import OCELFileExtensions

from app.dependencies import ApiOcel, ApiSession
from app.internal.exceptions import NotFound
from app.internal.model.base import PaginatedResponse
from app.internal.model.events import Date_Distribution_Item, Entity_Time_Info
from app.internal.model.ocel import (
    AggregatedAttribute,
    CaseCentricVariant,
    OCELFilter,
    OcelMetadata,
    QuantityInfo,
    TypedAttribute,
)
from app.internal.model.response import TempFileResponse
from app.internal.ocel.default_ocel import (
    DEFAULT_OCEL_KEYS,
    DefaultOCEL,
    filter_default_ocels,
    get_default_ocel,
)
from app.internal.registry import registry_manager
from app.internal.registry.extension import OCELExtensionDescription
from app.internal.util.filters import merge_filters, unmerge_filter
from app.internal.util.pandas import search_paginated_dataframe

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
        OcelMetadata.from_ocel(value.ocel)
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
def get_ocel(ocel: ApiOcel) -> OcelMetadata:
    return OcelMetadata.from_ocel(ocel)


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
    response_model=list[AggregatedAttribute],
    operation_id="AggregatedAttributes",
)
def get_aggr_attributes(ocel: ApiOcel):
    return AggregatedAttribute.from_df(ocel.attributes.get_aggr_summary())


@ocels_router.get(
    "/{ocel_id}/objects/attributes",
    response_model=list[TypedAttribute],
    operation_id="objectAttributes",
)
def get_object_attributes(
    ocel: ApiOcel, attribute_names: Annotated[list[str], Query()] = []
):
    return TypedAttribute.from_df(
        ocel.attributes.get_object_summary(
            attributes=None if len(attribute_names) == 0 else attribute_names
        )
    )


@ocels_router.get(
    "/{ocel_id}/events/attributes",
    response_model=list[TypedAttribute],
    operation_id="eventAttributes",
)
def get_event_attributes(
    ocel: ApiOcel, attribute_names: Annotated[list[str], Query()] = []
):
    return TypedAttribute.from_df(
        ocel.attributes.get_activity_summary(
            attributes=None if len(attribute_names) == 0 else attribute_names
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
    response_model=list[RelationCountSummary],
    operation_id="e2o",
)
def get_e2o(
    ocel: ApiOcel, direction: Literal["source", "target"] = "source"
) -> list[RelationCountSummary]:
    return ocel.e2o.summary(direction=direction)


@ocels_router.get(
    "/{ocel_id}/relations/o2o",
    response_model=list[RelationCountSummary],
    operation_id="o2o",
)
def get_object_relations(
    ocel: ApiOcel, direction: Literal["source", "target"] = "source"
) -> list[RelationCountSummary]:
    return ocel.o2o.summary(direction=direction)


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
# region Filters
@ocels_router.get(
    "/{ocel_id}/filter",
    operation_id="getFilters",
)
def get_filter(ocel: ApiOcel, session: ApiSession) -> Optional[OCELFilter]:
    return merge_filters(session.get_ocel_filters(ocel.meta.id))


@ocels_router.post(
    "/{ocel_id}/filter",
    operation_id="setFilters",
)
def set_filter(
    ocel: ApiOcel, session: ApiSession, filter: Optional[OCELFilter]
) -> Optional[OCELFilter]:
    session.filter_ocel(ocel.meta.id, unmerge_filter(filter or {}))

    return merge_filters(session.get_ocel_filters(ocel.meta.id))


# endregion
# region Executions
@ocels_router.get(
    "/{ocel_id}/executions/variants/${object_type}", operation_id="ObjectVariants"
)
def get_object_variants(ocel: ApiOcel, object_type: str) -> list[CaseCentricVariant]:
    return CaseCentricVariant.from_ocel(ocel, object_types=[object_type])


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
    )

    ocel.write_xes(object_type_name, Path(file_response.tmp_path))

    return file_response


# endregion
