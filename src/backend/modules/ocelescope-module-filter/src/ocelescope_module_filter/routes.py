from typing import cast

from fastapi import APIRouter
from ocelescope_backend.app.dependencies import ApiSession

from ocelescope_module_filter.filters import FILTER_SOURCE, NativeFilter

router = APIRouter()


@router.get("/{ocel_id}/filter", operation_id="getFilter")
def getFilter(
    ocel_id: str,
    session: ApiSession,
) -> list[NativeFilter]:
    return cast(list[NativeFilter], session.get_filter(ocel_id, FILTER_SOURCE))


@router.post("/{ocel_id}/filter", operation_id="setFilter")
def setFilter(ocel_id: str, body: list[NativeFilter], session: ApiSession):
    session.set_filter(ocel_id, FILTER_SOURCE, body)
