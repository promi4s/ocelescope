import functools
import hashlib
import json
from pathlib import Path
from typing import Any, Generic, Self, TypeVar

import orjson
from pydantic import BaseModel, computed_field
from pydantic_core import to_json

from ocelescope.resource.base import ResourceBase, ResourceMeta, ResourceResolver


class Resource(BaseModel, ResourceBase):
    """Abstract base class for pydantic (JSON-serializable) resources.

    Its internal storage and exchange format are the same JSON document.
    """

    @classmethod
    @functools.cache
    def get_schema_hash(cls) -> str:
        schema = json.dumps(cls.model_json_schema(), sort_keys=True)
        return hashlib.sha256(schema.encode()).hexdigest()

    @computed_field
    @property
    def _ocelescope_meta(self) -> ResourceMeta:
        return ResourceMeta(schema_hash=self.get_schema_hash())

    def dump(self, path: str | Path) -> Path:
        path = Path(path)
        path.write_bytes(to_json(self))
        return path

    @classmethod
    def load(cls, path: str | Path, resolve: ResourceResolver | None = None) -> Self:
        data = orjson.loads(Path(path).read_bytes())
        meta = ResourceMeta(**data.get(ResourceMeta.META_KEY, {"schema_hash": ""}))
        cls.check_schema_hash(meta.schema_hash, path)

        return cls.from_data(data, resolve)

    def write(self, path: str | Path) -> Path:
        return self.dump(self.exchange_path(path))

    @classmethod
    def detect_schema_hash(cls, path: Path) -> str | None:
        try:
            data = orjson.loads(path.read_bytes())
        except orjson.JSONDecodeError:
            return None

        if not isinstance(data, dict) or ResourceMeta.META_KEY not in data:
            return None
        return ResourceMeta(**data[ResourceMeta.META_KEY]).schema_hash

    @classmethod
    def read(cls, path: str | Path, resolve: ResourceResolver | None = None) -> Self:
        return cls.load(path, resolve)

    @classmethod
    def from_data(
        cls, data: dict[str, Any], resolve: ResourceResolver | None = None
    ) -> Self:
        """Build the resource from its JSON dump.

        Nested dumps are rebuilt as the class ``resolve`` returns for their schema
        hash; without it they are left to pydantic, which only knows the declared types.
        """
        fields = {
            key: _hydrate(value, resolve)
            for key, value in data.items()
            if key != ResourceMeta.META_KEY
        }

        return cls(**fields)


def _hydrate(value: Any, resolve: ResourceResolver | None) -> Any:
    if resolve is None:
        return value

    if isinstance(value, list):
        return [_hydrate(item, resolve) for item in value]

    if not isinstance(value, dict):
        return value

    if ResourceMeta.META_KEY not in value:
        return {key: _hydrate(item, resolve) for key, item in value.items()}

    resource_class = resolve(value[ResourceMeta.META_KEY]["schema_hash"])
    if not issubclass(resource_class, Resource):
        raise TypeError(
            f"{resource_class.__name__} cannot be nested in a JSON resource"
        )

    return resource_class.from_data(value, resolve)


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
