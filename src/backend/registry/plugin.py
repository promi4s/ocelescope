from types import ModuleType
from typing import Any, Optional, TypedDict
from ocelescope import OCEL, Resource
from ocelescope.plugin import Plugin
from ocelescope.plugin.decorators import PluginMethod
from api.model.plugin import PluginApi

from registry.resource import resource_registry


class PluginInput(TypedDict):
    input_ocels: dict[str, OCEL]
    input_resources: dict[str, Resource]
    input: dict[str, Any]


class PluginRegistry:
    def __init__(self):
        self._registry: dict[tuple[str, str], Plugin] = {}

    def register_plugin(self, module: ModuleType) -> Optional[Plugin]:
        plugin: Optional[type[Plugin]] = None
        for var in vars(module).values():
            if isinstance(var, type) and issubclass(var, Plugin):
                plugin = var
                break

        if plugin is not None:
            self._registry[(module.__name__, plugin.meta().name)] = plugin()
            for method in plugin.method_map().values():
                for resource in method._resource_types:
                    resource_registry.register_resource(resource)

    def list_plugins(self) -> list[PluginApi]:
        return [
            PluginApi(meta=plugin.meta(), methods=list(plugin.method_map().values()))
            for plugin in self._registry.values()
        ]

    def get_plugin(self, name: str) -> Optional[Plugin]:
        return next(
            (
                plugin
                for (_, plugin_name), plugin in self._registry.items()
                if plugin_name == name
            ),
            None,
        )

    def get_method(self, plugin_name: str, method_name: str) -> PluginMethod:
        plugin = self.get_plugin(plugin_name)
        if plugin is None:
            raise KeyError(f"Plugin {plugin_name} could not be found")

        method = plugin.method_map()[method_name]

        method._method = method._method.__get__(plugin, type(plugin))

        return method

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
