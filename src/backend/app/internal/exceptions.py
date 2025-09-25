from fastapi import HTTPException
from starlette.status import (
    HTTP_400_BAD_REQUEST,
    HTTP_401_UNAUTHORIZED,
    HTTP_402_PAYMENT_REQUIRED,
    HTTP_403_FORBIDDEN,
    HTTP_404_NOT_FOUND,
    HTTP_405_METHOD_NOT_ALLOWED,
)


class BadRequest(HTTPException):
    def __init__(self, detail: str | None = None):
        super().__init__(status_code=HTTP_400_BAD_REQUEST, detail=detail)


class Unauthorized(HTTPException):
    def __init__(self, detail: str | None = None):
        super().__init__(status_code=HTTP_401_UNAUTHORIZED, detail=detail)


class PaymentRequired(HTTPException):
    def __init__(self, detail: str | None = None):
        super().__init__(status_code=HTTP_402_PAYMENT_REQUIRED, detail=detail)


class Forbidden(HTTPException):
    def __init__(self, detail: str | None = None):
        super().__init__(status_code=HTTP_403_FORBIDDEN, detail=detail)


class NotFound(HTTPException):
    def __init__(self, detail: str | None = None):
        super().__init__(status_code=HTTP_404_NOT_FOUND, detail=detail)


class MethodNotAllowed(HTTPException):
    def __init__(self, detail: str | None = None):
        super().__init__(status_code=HTTP_405_METHOD_NOT_ALLOWED, detail=detail)


# ...
