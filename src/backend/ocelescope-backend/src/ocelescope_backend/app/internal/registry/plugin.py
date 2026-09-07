from types import ModuleType
from typing import Any, Optional, TypedDict

from ocelescope import OCEL, Plugin, PluginMethod, Resource
from ocelescope_backend.app.internal.model.plugin import PluginApi
from ocelescope_backend.app.internal.registry.resource import RegistryError


class PluginNotFound(RegistryError):
    """Raised when no plugin could be found for a lookup.

    Attributes:
        plugin_id: The registry id or module name the plugin was looked for in.
    """

    def __init__(self, plugin_id: str):
        self.plugin_id = plugin_id
        super().__init__(f"No plugin found for {plugin_id!r}")


class PluginAlreadyRegistered(RegistryError):
    """Raised when a plugin with the same name and version is already registered.

    Attributes:
        name: The name of the plugin that collided.
        version: The version of the plugin that collided.
    """

    def __init__(self, name: str, version: str):
        self.name = name
        self.version = version
        super().__init__(
            f"Plugin {name!r} with version {version!r} is already registered"
        )


class PluginInput(TypedDict):
    input_ocels: dict[str, OCEL]
    input_resources: dict[str, Resource]
    input: dict[str, Any]


class PluginRegistry:
    def __init__(self):
        self._registry: dict[str, Plugin] = {}

    def register(self, module: ModuleType) -> Plugin:
        plugin: Optional[type[Plugin]] = None
        for var in vars(module).values():
            if isinstance(var, type) and issubclass(var, Plugin):
                plugin = var
                break

        if plugin is None:
            raise PluginNotFound(module.__name__)

        meta = plugin.meta()
        if any(
            meta.name == existing_plugin.meta().name
            and meta.version == existing_plugin.meta().version
            for existing_plugin in self._registry.values()
        ):
            raise PluginAlreadyRegistered(name=meta.name, version=meta.version)

        self._registry[module.__name__] = plugin()
        return self._registry[module.__name__]

    def list_plugins(self) -> list[PluginApi]:
        return [
            PluginApi(
                id=id,
                meta=plugin.meta(),
                methods=list(plugin.method_map().values()),
            )
            for id, plugin in self._registry.items()
        ]

    def get_plugin(self, id: str) -> Optional[Plugin]:
        return self._registry.get(id)

    def get_plugin_by_name(
        self, name: str, version: str | None
    ) -> tuple[str, Plugin] | None:
        return next(
            (
                (id, plugin)
                for (id, plugin) in self._registry.items()
                if plugin.meta().name == name
                and (not version or plugin.meta().version == version)
            ),
            None,
        )

    def get_method(self, plugin_id: str, method_name: str) -> PluginMethod:
        plugin = self.get_plugin(plugin_id)
        if plugin is None:
            raise PluginNotFound(plugin_id)

        method = plugin.method_map()[method_name]

        method._method = method._method.__get__(plugin, type(plugin))  # ty: ignore[unresolved-attribute]

        return method

    def unload_module(self, id: str):
        self._registry.pop(id, None)
