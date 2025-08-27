from abc import ABC, abstractmethod
from typing import ClassVar
from pydantic import BaseModel

from ocelescope import Visualization


class Resource(BaseModel, ABC):
    """Abstract base class for resources.

    Attributes:
        label: Optional human-readable label for this resource class.
        description: Optional human-readable description for this resource class.
    """

    label: ClassVar[str | None]
    description: ClassVar[str | None]

    @classmethod
    def get_type(cls):
        """Return the simple type name of this resource.

        Returns:
            str: The class name (e.g., ``"PetriNet"``).
        """
        return cls.__name__

    @abstractmethod
    def visualize(self) -> Visualization | None:
        """Produce a visualization for this resource.

        Implementations should return a concrete :class:`Visualization`
        or ``None`` if no visualization exists.

        Returns:
            Optional[Visualization]: A visualization object or ``None``.
        """
        pass
