from abc import ABC
from typing import Generic, TypeVar
from pydantic import BaseModel
from uuid import uuid4
from datetime import datetime

from pydantic.fields import Field


class OutputBase(BaseModel, ABC):
    pass


T = TypeVar("T", bound=OutputBase)


class Output(BaseModel, Generic[T]):
    id: str = Field(default_factory=lambda: uuid4().hex)
    created_at: datetime = Field(default_factory=lambda: datetime.now())
    name: str
    output: T


class OutputApi(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex)
    created_at: datetime = Field(default_factory=lambda: datetime.now())
    name: str
    type_label: str
