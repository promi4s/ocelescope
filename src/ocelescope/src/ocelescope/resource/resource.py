from abc import ABC
from typing import ClassVar, Generic, TypeVar

from pydantic import BaseModel, computed_field

from ocelescope.visualization.visualization import Visualization


class Resource(BaseModel, ABC):
    """Abstract base class for resources.

    Attributes:
        label: Optional human-readable label for this resource class.
        description: Optional human-readable description for this resource class.
    """

    label: ClassVar[str | None] = None
    description: ClassVar[str | None] = None

    @classmethod
    def get_type(cls):
        """Return the simple type name of this resource.

        Returns:
            str: The class name (e.g., ``"PetriNet"``).
        """
        return cls.__name__

    @computed_field
    @property
    def _ocelescope_resource_type(self) -> str:
        return self.get_type()

    def visualize(self) -> Visualization | None:
        """Produce a visualization for this resource.

        Implementations should return a concrete :class:`Visualization`
        or ``None`` if no visualization exists.

        Returns:
            Optional[Visualization]: A visualization object or ``None``.
        """

        return


T = TypeVar("T", bound=Resource)


class Annotated(BaseModel, Generic[T]):
    annotation: T | str | None = None

    def get_annotation_str(self):
        return self.annotation if type(self.annotation) is str else None

    def get_annotation_visualization(self):
        return self.annotation.visualize() if isinstance(self.annotation, Resource) else None
