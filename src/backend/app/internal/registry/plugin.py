from types import ModuleType
from typing import Any, Optional, TypedDict
from ocelescope import OCEL, Resource, Plugin, PluginMethod
from api.model.plugin import PluginApi


class PluginInput(TypedDict):
    input_ocels: dict[str, OCEL]
    input_resources: dict[str, Resource]
    input: dict[str, Any]


class PluginRegistry:
    def __init__(self):
        self._registry: dict[str, Plugin] = {}

    def register(self, module: ModuleType) -> Optional[Plugin]:
        plugin: Optional[type[Plugin]] = None
        for var in vars(module).values():
            if isinstance(var, type) and issubclass(var, Plugin):
                plugin = var
                break

        if plugin is not None and not any(
            plugin.meta().name == existing_plugin.meta().name
            and plugin.meta().version == existing_plugin.meta().version
            for existing_plugin in self._registry.values()
        ):
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
        return self._registry[id]

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
            raise KeyError(f"Plugin {plugin_id} could not be found")

        method = plugin.method_map()[method_name]

        method._method = method._method.__get__(plugin, type(plugin))

        return method

    def unload_module(self, id: str):
        del self._registry[id]
