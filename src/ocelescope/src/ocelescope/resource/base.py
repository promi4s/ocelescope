from abc import ABC, abstractmethod
from collections.abc import Callable
from pathlib import Path
from typing import ClassVar, Self

from pydantic import BaseModel

from ocelescope.visualization.visualization import Visualization

EXCHANGE_SUFFIX = ".ocelescope"

ResourceResolver = Callable[[str], type["ResourceBase"]]
"""Looks up a resource class by its schema hash, e.g. to rebuild nested resources."""


class ResourceMeta(BaseModel):
    """Envelope emitted next to the payload of every dumped resource."""

    META_KEY: ClassVar[str] = "_ocelescope_meta"

    schema_hash: str


class ResourceBase(ABC):
    """Abstract base class shared by every kind of resource.

    Attributes:
        label: Optional human-readable label for this resource class.
        description: Optional human-readable description for this resource class.
    """

    label: ClassVar[str | None] = None
    description: ClassVar[str | None] = None

    @classmethod
    @abstractmethod
    def get_schema_hash(cls) -> str: ...

    @classmethod
    def check_schema_hash(cls, schema_hash: str, path: str | Path) -> None:
        if schema_hash != cls.get_schema_hash():
            raise ValueError(
                f"{Path(path).name} was written by a different version of {cls.__name__}"
            )

    # region Storage
    @abstractmethod
    def dump(self, path: str | Path) -> Path:
        """Persist the resource in its internal storage format."""

    @classmethod
    @abstractmethod
    def load(cls, path: str | Path, resolve: ResourceResolver | None = None) -> Self:
        """Load a resource written by :meth:`dump` into memory.

        Args:
            path: The file written by :meth:`dump`.
            resolve: Resolves nested resources by schema hash, for resources that
                hold other resources.
        """

    @classmethod
    def open(cls, path: str | Path, resolve: ResourceResolver | None = None) -> Self:
        """A read-only view on a file written by :meth:`dump`; :meth:`close` it when done.

        Defaults to :meth:`load`; resources that can read their file lazily override it.
        """
        return cls.load(path, resolve)

    @abstractmethod
    def write(self, path: str | Path) -> Path:
        """Write the ``.ocelescope`` exchange format to ``path``."""

    @classmethod
    @abstractmethod
    def read(cls, path: str | Path, resolve: ResourceResolver | None = None) -> Self:
        """Read a file written by :meth:`write`."""

    @classmethod
    @abstractmethod
    def detect_schema_hash(cls, path: Path) -> str | None:
        """The schema hash of ``path`` if it is in this kind's exchange format, else ``None``."""

    @staticmethod
    def read_schema_hash(path: str | Path) -> str:
        """The schema hash of an exchange file, used to look up its resource class.

        Each direct subclass of :class:`ResourceBase` is one exchange format and
        gets asked in turn whether ``path`` is one of its files.

        Raises:
            ValueError: If no format recognizes the file.
        """
        path = Path(path)

        for kind in ResourceBase.__subclasses__():
            if (schema_hash := kind.detect_schema_hash(path)) is not None:
                return schema_hash

        raise ValueError(f"{path.name} is not an Ocelescope resource file")

    @staticmethod
    def exchange_path(path: str | Path) -> Path:
        path = Path(path)
        if path.suffix != EXCHANGE_SUFFIX:
            path = path.with_name(path.name + EXCHANGE_SUFFIX)
        return path

    def close(self) -> None:
        """Release what :meth:`open` holds on to; a no-op by default."""

    def __enter__(self) -> Self:
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

    # endregion

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
