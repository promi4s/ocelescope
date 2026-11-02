from collections import defaultdict
from typing import ClassVar, TypeVar

from ocelescope import DirectlyFollowsGraph, OCELMapping, PetriNet, ResourceBase

T = TypeVar("T", bound=ResourceBase)


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
    CORE_SOURCE_ID: ClassVar[str] = "core"
    CORE_RESOURCES: ClassVar[list[type[ResourceBase]]] = [
        DirectlyFollowsGraph,
        OCELMapping,
        PetriNet,
    ]

    def __init__(self) -> None:
        self.resources: defaultdict[str, dict[str, type[ResourceBase]]] = defaultdict(
            dict
        )

        for resource_class in self.CORE_RESOURCES:
            self.register_resource(self.CORE_SOURCE_ID, resource_class)

    def register_resource(self, source_id: str, resource_class: type[T]):
        self.resources[resource_class.get_schema_hash()][source_id] = resource_class

    def get_resource_class(
        self, schema_hash: str, source_id: str | None = None
    ) -> type[ResourceBase]:

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

    def unload_module(self, source_id: str):
        for schema_hash, entry in list(self.resources.items()):
            entry.pop(source_id, None)

            if not entry:
                del self.resources[schema_hash]

    def resource_types(self) -> dict[str, type[ResourceBase]]:
        return {
            schema_hash: next(iter(entry.values()))
            for schema_hash, entry in self.resources.items()
        }


resource_registry = ResourceRegistry()
