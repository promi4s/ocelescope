from collections import defaultdict
from typing import Any, TypeVar

from ocelescope.resource.resource import ResourceMeta

from ocelescope import Resource

T = TypeVar("T", bound=Resource)


class RegistryError(Exception):
    """Base class for every error raised by a registry."""


class ResourceNotRegistered(RegistryError):
    """Raised when no registered resource class matches a lookup.

    Attributes:
        schema_hash: The schema hash that was looked up.
        source_id: The source the lookup was restricted to, if any.
    """

    def __init__(self, schema_hash: str, source_id: str | None = None):
        self.schema_hash = schema_hash
        self.source_id = source_id
        scope = f" for source {source_id!r}" if source_id else ""
        super().__init__(
            f"No resource registered with schema hash {schema_hash!r}{scope}"
        )


class ResourceRegistry:
    def __init__(self) -> None:
        self.resources: defaultdict[str, dict[str, type[Resource]]] = defaultdict(dict)

    def register_resource(self, source_id: str, resource_class: type[T]):
        self.resources[resource_class.get_schema_hash()][source_id] = resource_class

    def get_resource_class(
        self, schema_hash: str, source_id: str | None = None
    ) -> type[Resource]:

        entries = self.resources.get(schema_hash, {})

        resource_class = (
            entries.get(source_id)
            if source_id
            else next(
                iter(entries.values()),
                None,
            )
        )

        if not resource_class:
            raise ResourceNotRegistered(schema_hash=schema_hash, source_id=source_id)

        return resource_class

    @staticmethod
    def get_resource_meta(data: dict) -> ResourceMeta | None:
        return (
            ResourceMeta(**data[ResourceMeta.META_KEY])
            if ResourceMeta.META_KEY in data
            else None
        )

    def hydrate(self, data: Any, source_id: str | None = None):
        if isinstance(data, dict):
            meta = self.get_resource_meta(data)

            if meta:
                ResourceClass = self.get_resource_class(
                    schema_hash=meta.schema_hash, source_id=source_id
                )

                hydrated = {
                    k: self.hydrate(v, source_id)
                    for k, v in data.items()
                    if k != ResourceMeta.META_KEY
                }

                return ResourceClass(**hydrated).with_meta(**meta.extra)

            return {k: self.hydrate(v, source_id) for k, v in data.items()}
        elif isinstance(data, list):
            return [self.hydrate(item, source_id) for item in data]
        else:
            return data

    def get_resource_instance(
        self, resource: dict, source_id: str | None = None
    ) -> Resource:

        hydrated_resource = self.hydrate(resource, source_id)

        assert isinstance(hydrated_resource, Resource)

        return hydrated_resource

    def unload_module(self, source_id: str):
        for schema_hash, entry in list(self.resources.items()):
            entry.pop(source_id, None)

            if not entry:
                del self.resources[schema_hash]
