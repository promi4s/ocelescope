from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException

from ocelescope import OCEL
from ocelescope_backend.app.dependencies import ApiSession
from ocelescope_backend.app.internal.exceptions import NotFound


def get_original_ocel(session: ApiSession, ocel_id: str | None = None) -> OCEL:
    """Fetch the unfiltered OCEL, regardless of the request's ocel_version.

    Used for classification and validity checks that must stay stable across
    filter changes, alongside the filtered `ApiOcel` used for the returned data.
    """
    if not ocel_id:
        raise HTTPException(status_code=500, detail="Ocel id is required")
    try:
        return session.get_ocel(ocel_id, use_original=True)
    except NotFound as error:
        raise HTTPException(status_code=404, detail="OCEL not found") from error


ApiOriginalOcel = Annotated[OCEL, Depends(get_original_ocel)]


def known_activities(ocel: OCEL) -> set[str]:
    return {str(activity) for activity in ocel.events.activities}


def known_object_types(ocel: OCEL) -> set[str]:
    return set(ocel.objects.types)
