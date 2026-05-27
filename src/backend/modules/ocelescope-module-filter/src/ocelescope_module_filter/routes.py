from typing import cast

from fastapi import APIRouter
from ocelescope_backend.app.dependencies import ApiSession

from ocelescope_module_filter.models import (
    GroupedOCELFilter,
    NativeFilter,
    NativeFilterBase,
)

router = APIRouter()


@router.get("/{ocel_id}/filter", operation_id="getFilter")
def getFitler(
    ocel_id: str,
    session: ApiSession,
) -> GroupedOCELFilter:

    native_filter_list = cast(
        list[NativeFilter],
        session.get_filter(ocel_id, NativeFilterBase.OcelescopeModuleSource),
    )

    return GroupedOCELFilter.from_pipeline(native_filter_list)


@router.post("/{ocel_id}/filter", operation_id="setFilter")
def setFilter(ocel_id: str, body: GroupedOCELFilter, session: ApiSession):
    return cast(
        list[NativeFilter],
        session.set_filter(
            ocel_id, NativeFilterBase.OcelescopeModuleSource, body.to_pipeline()
        ),
    )
