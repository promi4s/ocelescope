from __future__ import annotations

from typing import Annotated, Literal

from fastapi import Depends

from api.exceptions import NotFound
from api.session import Session
from ocelescope import OCEL


from fastapi import Request, HTTPException


def get_session(request: Request) -> Session:
    session = getattr(request.state, "session", None)
    if not session:
        raise HTTPException(status_code=500, detail="Session middleware not set")
    return session


ApiSession = Annotated[Session, Depends(get_session)]


def get_ocel(
    session: ApiSession,
    ocel_id: str | None = None,
    ocel_version: Literal["original", "filtered"] | None = "filtered",
):
    # Used so the generated react queries don't required them so they can be injected from the session strorage
    if not ocel_id:
        raise HTTPException(status_code=500, detail="Ocel id is requiered")
    try:
        return session.get_ocel(
            ocel_id, use_original=False if ocel_version != "original" else True
        )
    except NotFound:
        raise HTTPException(status_code=404, detail="OCEL not found")


ApiOcel = Annotated[OCEL, Depends(get_ocel)]
