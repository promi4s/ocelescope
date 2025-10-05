from abc import ABC
from typing import Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T", bound=str)


class Visualization(BaseModel, ABC, Generic[T]):
    type: T
