from datetime import datetime
from typing import Any, Self

from ocelescope.resource.resource import ResourceMeta
from pydantic import BaseModel, Field

from ocelescope import Resource

META_KEY = "ocelescope_meta"


class ResourceInfo(BaseModel):
    """Ocelescope-owned metadata, carried in the resource envelope's ``extra``."""

    name: str
    created_at: str = Field(default_factory=lambda: str(datetime.now()))
    source_id: str | None = None


class ResourceBase(ResourceInfo):
    schema_hash: str


class ResourceStore(ResourceBase):
    data: dict[str, Any]

    @property
    def info(self) -> ResourceInfo:
        return ResourceInfo(**self.model_dump(include=set(ResourceInfo.model_fields)))

    def export(self) -> dict:
        envelope = self.data.get(
            ResourceMeta.META_KEY, {"schema_hash": self.schema_hash}
        )
        meta = ResourceMeta(**envelope)
        meta.extra[META_KEY] = self.info.model_dump()

        return {**self.data, ResourceMeta.META_KEY: meta.model_dump()}

    @classmethod
    def read_from_dict(cls, data: dict, name: str) -> Self:
        meta = ResourceMeta(**data.get(ResourceMeta.META_KEY, {}))
        info = meta.extra.get(META_KEY, {})

        return cls(
            data=data,
            **{"name": name, **info, "schema_hash": meta.schema_hash},
        )

    @classmethod
    def from_resource(
        cls, resource: Resource, name: str, source_id: str | None = None
    ) -> Self:
        return cls(
            data=resource.model_dump(mode="json"),
            name=name,
            schema_hash=resource.get_schema_hash(),
            source_id=source_id,
        )


class ResourceApi(ResourceBase):
    id: str
    resource_type_label: str
