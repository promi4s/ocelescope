import logging
from dataclasses import dataclass

from ocelescope import OCELExtension, Resource
from ocelescope_backend.app.internal.registry.extension import ExtensionRegistry
from ocelescope_backend.app.internal.registry.resource import ResourceRegistry


class ModuleRegistry:
    """Loads and unloads resources and OCEL extensions on behalf of a single module.

    Both are registered under the module's source id, or under a namespace of it
    (``<source_id>:<namespace>``) so a module can manage independent groups, e.g.
    one per plugin.
    """

    def __init__(
        self,
        resource_registry: ResourceRegistry,
        extension_registry: ExtensionRegistry,
        source_id: str,
    ) -> None:
        self._resource_registry = resource_registry
        self._extension_registry = extension_registry
        self._source_id = source_id

    def get_source_id(self, namespace: str | None = None) -> str:
        return f"{self._source_id}:{namespace}" if namespace else self._source_id

    def load(
        self,
        resources: list[type[Resource]],
        extensions: list[type[OCELExtension]],
        namespace: str | None = None,
    ) -> None:
        source_id = self.get_source_id(namespace)
        for resource in resources:
            self._resource_registry.register_resource(source_id, resource)
        for extension in extensions:
            self._extension_registry.register_extension(source_id, extension)

    def unload(self, namespace: str | None = None) -> None:
        source_id = self.get_source_id(namespace)
        self._resource_registry.unload_module(source_id)
        self._extension_registry.unload_module(source_id)


@dataclass(frozen=True)
class ModuleContext:
    """Everything the host provides to a module.

    New fields must have a default so existing modules keep working.
    """

    logger: logging.Logger
    registry: ModuleRegistry
    source_id: str
    mount_path: str
