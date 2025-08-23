from abc import ABC, abstractmethod
from typing import ClassVar
from pydantic import BaseModel

from ocelescope import Visualization


class Resource(BaseModel, ABC):
    label: ClassVar[str | None]
    description: ClassVar[str | None]

    @classmethod
    def get_type(cls):
        return cls.__name__

    @abstractmethod
    def visualize(self) -> Visualization | None:
        pass
