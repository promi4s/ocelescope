from fastapi import Request, Response, status
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from ocelescope_backend.app.internal.config import config


async def error_handler_server(request: Request, exc: Exception) -> Response:
    headers = getattr(exc, "headers", None)
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    if isinstance(exc, RequestValidationError):
        return await request_validation_exception_handler(request, exc)

    if config.EXPOSE_ERROR_DETAILS:
        detail = f"{type(exc).__name__}: {exc}"
    else:
        detail = "Internal Server Error"

    return JSONResponse({"detail": detail}, status_code=status_code, headers=headers)
