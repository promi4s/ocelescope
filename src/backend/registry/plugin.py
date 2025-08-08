from types import ModuleType
from typing import Optional
from ocelescope.plugin import Plugin

from api.model.plugin import PluginApi

from registry.resource import resource_registry


class PluginRegistry:
    def __init__(self):
        self._registry: dict[tuple[str, str], type[Plugin]] = {}

    def register_plugin(self, module: ModuleType) -> Optional[Plugin]:
        plugin: Optional[type[Plugin]] = None
        for var in vars(module).values():
            if isinstance(var, type) and issubclass(var, Plugin):
                plugin = var
                break

        if plugin is not None:
            self._registry[(module.__name__, plugin.meta().name)] = plugin
            for method in plugin.method_map().values():
                for resource in method._resource_types:
                    resource_registry.register_resource(resource)

    def list_plugins(self) -> list[PluginApi]:
        return [
            PluginApi(meta=plugin.meta(), methods=list(plugin.method_map().values()))
            for plugin in self._registry.values()
        ]

    def get_plugin(self, name: str) -> Optional[type[Plugin]]:
        return next(
            (
                plugin
                for (plugin_name, _), plugin in self._registry.items()
                if plugin_name == name
            ),
            None,
        )

    def get_plugin_module(self, name: str) -> Optional[str]:
        return next(
            (
                module_name
                for (plugin_name, module_name) in self._registry.keys()
                if plugin_name == name
            ),
            None,
        )

    def unload_module(self, module_name: str) -> list[str]:
        keys_to_remove = [key for key in self._registry if key[1] == module_name]
        for key in keys_to_remove:
            self._registry.pop(key)

        return [name for (name, _) in keys_to_remove]


plugin_registy = PluginRegistry()
