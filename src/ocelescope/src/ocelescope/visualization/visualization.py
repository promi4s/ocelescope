from abc import ABC
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=str)


class Visualization(BaseModel, ABC, Generic[T]):
    """Base class for all frontend visualizations.

    A visualization is a JSON-serializable object that a `Resource.visualize()` method
    can return so the frontend can render the resource.

    Every visualization has a `type` discriminator. Concrete subclasses set `type`
    to a fixed literal value (for example `"table"` or `"plotly"`).

    Attributes:
        type: Discriminator used by the frontend to select the renderer.
    """

    type: T
