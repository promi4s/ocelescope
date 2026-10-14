import hashlib
import json
from pathlib import Path
from typing import Any, ClassVar, Generic, Self, TypeVar

import orjson
from pydantic import BaseModel, Field, PrivateAttr, computed_field
from pydantic_core import to_json

from ocelescope.resource.base import ResourceBase


class ResourceMeta(BaseModel):
    """Envelope emitted next to the payload of every dumped resource."""

    META_KEY: ClassVar[str] = "_ocelescope_meta"

    schema_hash: str
    extra: dict[str, Any] = Field(default_factory=dict)


class Resource(BaseModel, ResourceBase):
    """Abstract base class for pydantic (JSON-serializable) resources."""

    _meta: dict[str, Any] = PrivateAttr(default_factory=dict)

    @classmethod
    def get_schema_hash(cls) -> str:
        schema = json.dumps(cls.model_json_schema(), sort_keys=True)
        return hashlib.sha256(schema.encode()).hexdigest()

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
