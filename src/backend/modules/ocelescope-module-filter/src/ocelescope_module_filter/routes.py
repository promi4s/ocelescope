from typing import cast

from fastapi import APIRouter
from ocelescope_backend.app.dependencies import ApiSession

from ocelescope_module_filter.models import (
    NativeFilter,
    NativeFilterBase,
    OCELFilterBody,
)

router = APIRouter()


@router.get("/{ocel_id}/filter", operation_id="getFilter")
def getFitler(
    ocel_id: str,
    session: ApiSession,
) -> OCELFilterBody:
    return OCELFilterBody(
        pipeline=cast(
            list[NativeFilter],
            session.get_filter(ocel_id, NativeFilterBase.OcelescopeModuleSource),
        )
    )


@router.post("/{ocel_id}/filter", operation_id="setFilter")
def setFilter(ocel_id: str, body: OCELFilterBody, session: ApiSession):
    return cast(
        list[NativeFilter],
        session.set_filter(
            ocel_id, NativeFilterBase.OcelescopeModuleSource, body.pipeline
        ),
    )
