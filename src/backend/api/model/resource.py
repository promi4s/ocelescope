from typing import Generic, TypeVar
from ocelescope import Resource as ResourceBase
from pydantic import BaseModel
from uuid import uuid4
from datetime import datetime

from pydantic.fields import Field


T = TypeVar("T", bound=ResourceBase)


class Resource(BaseModel, Generic[T]):
    id: str = Field(default_factory=lambda: uuid4().hex)
    created_at: datetime = Field(default_factory=lambda: datetime.now())
    name: str
    resource: T


class ResourceApi(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex)
    created_at: datetime = Field(default_factory=lambda: datetime.now())
    name: str
    type_label: str
