from abc import ABC, abstractmethod
from typing import Any, ClassVar, Self

from pydantic_core import PydanticSerializationError, to_json

from ocelescope.visualization.visualization import Visualization


class ResourceBase(ABC):
    """Abstract base class shared by every kind of resource.

    Attributes:
        label: Optional human-readable label for this resource class.
        description: Optional human-readable description for this resource class.
    """

    label: ClassVar[str | None] = None
    description: ClassVar[str | None] = None

    _meta: dict[str, Any]

    @property
    def meta(self) -> dict[str, Any]:
        return self._meta

    def with_meta(self, **entries: Any) -> Self:
        """Attach metadata entries and return ``self`` for chaining.

        Every value is dumped once up front, so a value that would break
        serialization of the whole resource fails here instead of at dump time.
        Nothing is attached if any entry is rejected.

        Raises:
            ValueError: If an entry cannot be serialized by pydantic.
        """
        for key, value in entries.items():
            try:
                to_json(value)
            except PydanticSerializationError as error:
                raise ValueError(
                    f"Meta entry {key!r} of {type(self).__name__} is not serializable: {error}"
                ) from error

        self._meta.update(entries)
        return self

    @classmethod
    @abstractmethod
    def get_schema_hash(cls) -> str: ...

    @classmethod
    def get_label(cls) -> str:
        return cls.label or cls.__name__

    def visualize(self) -> Visualization | None:
        """Produce a visualization for this resource.

        Implementations should return a concrete :class:`Visualization`
        or ``None`` if no visualization exists.

        Returns:
            Optional[Visualization]: A visualization object or ``None``.
        """
