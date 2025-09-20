import inspect
import re
from typing import Callable

from fastapi import FastAPI, Request, Response
from fastapi import params as fastapi_params
from fastapi import status
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic.fields import FieldInfo
from starlette.routing import Route

from api.config import config
from api.logger import logger


async def error_handler_server(request: Request, exc: Exception) -> Response:
    headers = getattr(exc, "headers", None)
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    if isinstance(exc, RequestValidationError):
        return await request_validation_exception_handler(request, exc)

    # Other type of error. If EXPOSE_ERROR_DETAILS is True, send the error message.
    # This should only be done in dev environments!
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


def verify_parameter_alias_consistency(
    app: FastAPI, alias_generator: Callable[[str], str]
):
    """Checks if there are parameters of API routes that do not have an alias consistent with a given alias generator."""
    fts = (
        fastapi_params.Query,
        fastapi_params.Path,
        fastapi_params.Body,
        FieldInfo,
    )
    for route in app.routes:
        if isinstance(route, Route):
            sig = inspect.signature(route.endpoint)
            for parameter in sig.parameters.values():
                field = parameter.default
                # if not field:
                #     logger.warning(
                #         f"Route '{route.path}': Parameter '{parameter.name}' does not have a Query/Body/... spec."
                #     )
                # elif
                if isinstance(field, fts):
                    computed_alias = alias_generator(parameter.name)
                    if computed_alias not in (parameter.name, field.alias):
                        logger.warning(
                            f"Route '{route.path}': Detected inconsistent alias name for parameter '{parameter.name}'."
                        )

                    if isinstance(field, fts):
                        expected = alias_generator(parameter.name)
                        current = field.alias or parameter.name
                        if current != expected:
                            if field.alias:
                                logger.warning(
                                    f"Route '{route.path}': Detected inconsistent alias name for parameter '{parameter.name}' ('{current}', should be '{expected}')."
                                )
                            else:
                                logger.warning(
                                    f"Route '{route.path}': Parameter '{parameter.name}' is missing an alias (Should be '{expected}')."
                                )
