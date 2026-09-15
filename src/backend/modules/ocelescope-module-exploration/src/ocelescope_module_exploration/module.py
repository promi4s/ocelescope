from __future__ import annotations

from collections.abc import Iterator
from typing import Annotated

from fastapi import Body, Depends, FastAPI, HTTPException
from ocelescope_backend.app.dependencies import ApiOcel, ApiSession
from ocelescope_backend.app.internal.exceptions import NotFound
from ocelescope_backend.app.modules import Module, ModuleMeta
from packaging.version import Version

from ocelescope import OCEL
from ocelescope_module_exploration.analyses import Query
from ocelescope_module_exploration.log import InvalidQuery, Log, Result


def original_log(session: ApiSession, ocel_id: str) -> Iterator[OCEL]:
    """The unfiltered log, whatever `ocel_version` the request asks for."""
    try:
        ocel = session.get_ocel(ocel_id, use_original=True)
    except NotFound as error:
        raise HTTPException(status_code=404, detail="OCEL not found") from error
    try:
        yield ocel
    finally:
        ocel.close()


def run_query(
    ocel: ApiOcel,
    original: Annotated[OCEL, Depends(original_log)],
    query: Annotated[Query, Body(discriminator="analysis")],
) -> Result:
    """Run the analysis named by the body's `analysis` field."""
    try:
        return query.run(Log(filtered=ocel, original=original))
    except InvalidQuery as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


class Exploration(Module):
    meta = ModuleMeta(key="exploration", version=Version("1.0"))

    @classmethod
    def create_app(cls) -> FastAPI:
        app = FastAPI(
            title="Exploration",
            version=str(cls.meta.version),
            docs_url=None,
            redoc_url=None,
        )
        app.post(
            "/ocels/{ocel_id}/queries", operation_id="runQuery", tags=["exploration"]
        )(run_query)
        return app
