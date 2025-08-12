from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, TYPE_CHECKING

from pandas import Series
from pydantic import BaseModel


if TYPE_CHECKING:
    from ocelescope import OCEL


@dataclass()
class FilterResult:
    events: Optional[Series] = None
    objects: Optional[Series] = None

    def and_merge(self, other: "FilterResult") -> "FilterResult":
        def _and(a, b):
            if a is not None and b is not None:
                return a & b
            elif a is not None:
                return a
            elif b is not None:
                return b
            else:
                return None

        return FilterResult(
            events=_and(self.events, other.events),
            objects=_and(self.objects, other.objects),
        )


class BaseFilter(ABC, BaseModel):
    @abstractmethod
    def filter(self, ocel: "OCEL") -> FilterResult:
        pass
