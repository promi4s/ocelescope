import hashlib
import json
from abc import ABC
from pathlib import Path
from typing import Any, ClassVar, Generic, Self, TypeVar

import orjson
from pydantic import BaseModel, Field, PrivateAttr, computed_field
from pydantic_core import PydanticSerializationError, to_json

from ocelescope.visualization.visualization import Visualization


class ResourceMeta(BaseModel):
    """Envelope emitted next to the payload of every dumped resource."""

    META_KEY: ClassVar[str] = "_ocelescope_meta"

    schema_hash: str
    extra: dict[str, Any] = Field(default_factory=dict)


class Resource(BaseModel, ABC):
    """Abstract base class for resources.

    Attributes:
        label: Optional human-readable label for this resource class.
        description: Optional human-readable description for this resource class.
    """

    label: ClassVar[str | None] = None
    description: ClassVar[str | None] = None

    _meta: dict[str, Any] = PrivateAttr(default_factory=dict)

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
    def get_schema_hash(cls) -> str:
        schema = json.dumps(cls.model_json_schema(), sort_keys=True)
        return hashlib.sha256(schema.encode()).hexdigest()

    @classmethod
    def get_label(cls) -> str:
        return cls.label or cls.__name__

    @computed_field
    @property
    def _ocelescope_meta(self) -> ResourceMeta:
        return ResourceMeta(schema_hash=self.get_schema_hash(), extra=self._meta)

    def write(self, path: str | Path) -> Path:
        path = Path(path)

        if path.suffix != ".ocelescope":
            path = path.with_name(path.name + ".ocelescope")

        path.write_bytes(to_json(self))

        return path

    @classmethod
    def read(cls, path: str | Path) -> Self:
        data = orjson.loads(Path(path).read_bytes())

        meta = ResourceMeta(**data.pop(ResourceMeta.META_KEY, {"schema_hash": ""}))

        if meta.schema_hash != cls.get_schema_hash():
            raise ValueError(
                f"{Path(path).name} was written by a different version of {cls.__name__}"
            )

        return cls(**data).with_meta(**meta.extra)

    def visualize(self) -> Visualization | None:
        """Produce a visualization for this resource.

        Implementations should return a concrete :class:`Visualization`
        or ``None`` if no visualization exists.

        Returns:
            Optional[Visualization]: A visualization object or ``None``.
        """

        ...


T = TypeVar("T", bound=Resource)


class Annotated(BaseModel, Generic[T]):
    annotation: list[T] | str = []

    def get_annotation_str(self):
        return self.annotation if type(self.annotation) is str else None

    def get_annotation_visualization(self):
        if not isinstance(self.annotation, list) or len(self.annotation) != 1:
            return None
        resource = self.annotation[0]
        if not isinstance(resource, Resource):
            return None
        return resource.visualize()
