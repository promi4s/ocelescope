from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING

from ocelescope import Resource

if TYPE_CHECKING:
    from ocelescope_backend.app.internal.registry.resource import ResourceRegistry


class ModuleRegistry:
    """Loads and unloads resources on behalf of a single module.

    Resources are registered under the module's source id, or under a namespace
    of it (``<source_id>:<namespace>``) so a module can manage independent groups,
    e.g. one per plugin.
    """

    def __init__(self, resource_registry: ResourceRegistry, source_id: str) -> None:
        self._resource_registry = resource_registry
        self._source_id = source_id

    def get_source_id(self, namespace: str | None = None) -> str:
        return f"{self._source_id}:{namespace}" if namespace else self._source_id

    def load(
        self, resources: list[type[Resource]], namespace: str | None = None
    ) -> None:
        source_id = self.get_source_id(namespace)
        for resource in resources:
            self._resource_registry.register_resource(source_id, resource)

    def unload(self, namespace: str | None = None) -> None:
        self._resource_registry.unload_module(self.get_source_id(namespace))


@dataclass(frozen=True)
class ModuleContext:
    """Everything the host provides to a module.

    New fields must have a default so existing modules keep working.
    """

    logger: logging.Logger
    registry: ModuleRegistry
    source_id: str
    mount_path: str
