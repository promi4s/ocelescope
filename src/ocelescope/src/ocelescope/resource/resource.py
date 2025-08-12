from abc import ABC, abstractmethod
from pydantic import BaseModel

from ocelescope import Visualization


class Resource(BaseModel, ABC):
    @abstractmethod
    def visualize(self) -> Visualization:
        pass
