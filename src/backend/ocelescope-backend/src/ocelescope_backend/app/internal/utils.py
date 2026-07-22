import re

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


def custom_snake2camel(s: str):
    """Converts the input from snake to camel case, with parts like 'e2o' being either completely capitalized or not at all."""
    parts = s.split("_")
    x2y_regex = re.compile(r"^[a-z]2[a-z]$")
    camel_parts = [
        p.capitalize() if not x2y_regex.match(p) else p.upper() for p in parts[1:]
    ]
    return parts[0] + "".join(camel_parts)
