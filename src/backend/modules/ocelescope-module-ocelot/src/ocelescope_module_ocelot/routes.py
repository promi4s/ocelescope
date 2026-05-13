from fastapi import APIRouter
from ocelescope_backend.app.dependencies import ApiSession

router = APIRouter()


@router.get("/ping")
def ping() -> dict[str, object]:
    return {"ok": True, "module": "test-module"}


@router.get("/session")
def session_info(session: ApiSession) -> dict[str, str]:
    return {"session_id": session.id}
