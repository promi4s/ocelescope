from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING, Optional, Union

import pandas as pd
import polars as pl
from pydantic import BaseModel

if TYPE_CHECKING:
    from ocelescope.ocel.core.ocel import OCEL

BooleanMask = Union[pd.Series, pl.Series]


def _as_polars_mask(mask: BooleanMask) -> pl.Series:
    """Normalize a pandas-or-polars boolean mask to a polars Series.

    Polars is the canonical form (it's the OCEL's internal storage type and,
    unlike pandas, combines purely positionally with no index-alignment
    surprises), so masks are upcast to polars rather than downcast to pandas.
    """
    return pl.from_pandas(mask) if isinstance(mask, pd.Series) else mask


@dataclass()
class FilterResult:
    events: Optional[BooleanMask] = None
    objects: Optional[BooleanMask] = None
    e2o: Optional[BooleanMask] = None
    o2o: Optional[BooleanMask] = None

    def and_merge(self, other: "FilterResult") -> "FilterResult":
        """Combine two results field-by-field with logical AND.

        Masks are normalized to polars before combining, so a pandas mask
        from one filter and a polars mask from another can be AND-merged
        together.
        """

        def _and(a: Optional[BooleanMask], b: Optional[BooleanMask]) -> Optional[pl.Series]:
            a = _as_polars_mask(a) if a is not None else None
            b = _as_polars_mask(b) if b is not None else None

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
            e2o=_and(self.e2o, other.e2o),
            o2o=_and(self.o2o, other.o2o),
        )


class BaseFilter(ABC, BaseModel):
    @abstractmethod
    def filter(self, ocel: "OCEL") -> FilterResult:
        pass
