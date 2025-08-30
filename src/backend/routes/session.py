from __future__ import annotations


from fastapi.routing import APIRouter

from fastapi import Request
from fastapi.responses import Response, JSONResponse

from api.config import config
from api.session import Session


session_router = APIRouter(prefix="/session", tags=["session"])


@session_router.post("/logout", summary="Deletes the Session", operation_id="logout")
def logout(request: Request, response: Response):
    session_id = request.headers.get(config.SESSION_ID_HEADER)

    response = JSONResponse({"message": "Logged out"}, status_code=200)
    if session_id is not None and session_id in Session.sessions:
        Session.sessions.pop(session_id)

    return response
