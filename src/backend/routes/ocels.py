import datetime
from pathlib import Path
from typing import Literal, Optional

from ocelescope.ocel.filter import OCELFilter
from ocelescope.ocel.ocel import OCELFileExtensions

from api.dependencies import ApiOcel, ApiSession
from api.exceptions import NotFound
from api.model.base import PaginatedResponse
from api.model.events import Date_Distribution_Item, Entity_Time_Info
from api.model.ocel import OcelMetadata
from api.model.response import TempFileResponse
from ocelescope import AttributeSummary, RelationCountSummary

from ocel.default_ocel import (
    DEFAULT_OCEL_KEYS,
    DefaultOCEL,
    filter_default_ocels,
    get_default_ocel,
)
from registry import registry_manager

from fastapi import APIRouter, Query, Response

from util.pandas import search_paginated_dataframe


ocels_router = APIRouter(prefix="/ocels", tags=["ocels"])


# region Management
@ocels_router.get(
    "/",
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
    extension_descriptions = registry_manager.get_extension_descriptions()

    return [
        OcelMetadata(
            created_at=value.original.meta["uploadDate"],
            id=key,
            name=value.original.meta["fileName"],
            extensions=[
                extension_descriptions[extension.__class__.__name__]
                for extension in value.original.get_extensions_list()
                if extension.__class__.__name__ in extension_descriptions
            ],
        )
        for key, value in session.ocels.items()
        if extension_name is None
        or extension_name
        in [
            extension.__class__.__name__
            for extension in value.original.get_extensions_list()
        ]
    ]


@ocels_router.post(
    "/ocel/delete",
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
    "/ocel/rename",
    summary="Rename an uploaded OCEL",
    description=(
        "Renames the OCEL represented by the given `ApiOcel` object to `new_name`. "
        "This updates the display name used in the UI and metadata."
    ),
    operation_id="renameOcel",
)
def rename_ocel(ocel: ApiOcel, new_name: str):
    ocel.rename(new_name)


# endregion
# region Info
@ocels_router.get(
    "/objects/attributes",
    response_model=dict[str, list[AttributeSummary]],
    operation_id="objectAttributes",
)
def get_object_attributes(
    ocel: ApiOcel,
):
    return ocel.object_attribute_summary


@ocels_router.get(
    "/events/attributes",
    response_model=dict[str, list[AttributeSummary]],
    operation_id="eventAttributes",
)
def get_event_attributes(
    ocel: ApiOcel,
):
    return ocel.event_attribute_summary


@ocels_router.get(
    "/events/counts",
    response_model=dict[str, int],
    operation_id="eventCounts",
)
def get_event_counts(
    ocel: ApiOcel,
) -> dict[str, int]:
    return ocel.activity_counts.to_dict()


@ocels_router.get(
    "/events/time",
    response_model=Entity_Time_Info,
    operation_id="timeInfo",
)
def get_time_info(
    ocel: ApiOcel,
) -> Entity_Time_Info:
    events = ocel.events
    timestamp_column_name = ocel.ocel.event_timestamp
    activity_column_name = ocel.ocel.event_activity

    # Group by date and activity, then count
    time_frame_count = (  # type:ignore
        events.groupby([events[timestamp_column_name].dt.date, activity_column_name])
        .size()
        .reset_index(name="count")
    )

    # Build distribution per date
    date_distribution = []
    for date, group in time_frame_count.groupby(timestamp_column_name):
        row = {
            "date": str(date),
            "entity_count": dict(zip(group[activity_column_name], group["count"])),
        }
        date_distribution.append(Date_Distribution_Item(**row))

    # Get start and end time of events
    start_time = events[timestamp_column_name].min().isoformat(timespec="microseconds")
    end_time = events[timestamp_column_name].max().isoformat(timespec="microseconds")

    return Entity_Time_Info(
        end_time=end_time,
        start_time=start_time,
        date_distribution=date_distribution,
    )


@ocels_router.get(
    "/objects/counts",
    response_model=dict[str, int],
    operation_id="objectCount",
)
def get_object_counts(
    ocel: ApiOcel,
) -> dict[str, int]:
    return ocel.otype_counts.to_dict()


@ocels_router.get(
    "/relations/e2o",
    response_model=list[RelationCountSummary],
    operation_id="e2o",
)
def get_e2o(
    ocel: ApiOcel, direction: Optional[Literal["source", "target"]] = "source"
) -> list[RelationCountSummary]:
    return ocel.e2o_summary(direction=direction)


@ocels_router.get(
    "/relations/o2o",
    response_model=list[RelationCountSummary],
    operation_id="o2o",
)
def get_object_relations(
    ocel: ApiOcel, direction: Optional[Literal["source", "target"]] = "source"
) -> list[RelationCountSummary]:
    return ocel.o2o_summary(direction=direction)


@ocels_router.get("/events/ids", operation_id="eventIds")
def get_event_ids(
    ocel: ApiOcel,
    search: str | None = None,
    size: int = 10,
    page: int = 1,
) -> PaginatedResponse[list[str]]:
    filtered_df = search_paginated_dataframe(
        df=ocel.events,
        page=page,
        page_size=size,
        query=search,
        search_column=ocel.ocel.event_id_column,
    )

    event_ids: list[str] = filtered_df[ocel.ocel.event_id_column].to_list()

    return PaginatedResponse(
        response=event_ids, page=page, page_size=size, total_items=len(ocel.events)
    )


@ocels_router.get("/objects/ids", operation_id="objectIds")
def get_object_ids(
    ocel: ApiOcel,
    search: str | None = None,
    size: int = 10,
    page: int = 1,
) -> PaginatedResponse[list[str]]:
    filtered_df = search_paginated_dataframe(
        df=ocel.objects,
        page=page,
        page_size=size,
        query=search,
        search_column=ocel.ocel.object_id_column,
    )

    object_ids: list[str] = filtered_df[ocel.ocel.object_id_column].to_list()

    return PaginatedResponse(
        response=object_ids, page=page, page_size=size, total_items=len(ocel.objects)
    )


# endregion
# region Filters
@ocels_router.get(
    "/filter",
    operation_id="getFilters",
)
def get_filter(ocel: ApiOcel, session: ApiSession) -> Optional[OCELFilter]:
    return session.get_ocel_filters(ocel.id)


@ocels_router.post(
    "/",
    operation_id="setFilters",
)
def set_filter(
    ocel: ApiOcel, session: ApiSession, filter: Optional[OCELFilter]
) -> Optional[OCELFilter]:
    session.filter_ocel(ocel_id=ocel.id, filters=filter)

    return session.get_ocel_filters(ocel.id)


# endregion
# region Import/Export
@ocels_router.get(
    "/ocel/default", summary="Get default OCEL metadata", operation_id="getDefaultOcel"
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
    "/import-default", summary="Import default OCEL", operation_id="importDefaultOcel"
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

    session.add_ocel(ocel)
    response.status_code = 200

    return response


@ocels_router.get("/download", summary="Download OCEL including app state")
def download_ocel(
    ocel: ApiOcel,
    ext: OCELFileExtensions,
) -> TempFileResponse:
    name = ocel.meta["fileName"]
    tmp_file_prefix = datetime.datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + name

    file_response = TempFileResponse(
        prefix=tmp_file_prefix, suffix=ext, filename=name + ext
    )

    ocel.write_ocel(Path(file_response.tmp_path), ext)

    return file_response


# endregion
