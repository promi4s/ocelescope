import importlib.util
import shutil
import sys

from ocelescope import Plugin, Resource
from api.config import config
from api.model.plugin import PluginApi
from api.model.resource import ResourceStore
from registry.registries.extension import ExtensionRegistry
from registry.registries.plugin import PluginRegistry
from registry.registries.resource import ResourceRegistry


class RegistryManager:
    def __init__(self):
        self._plugin_registry = PluginRegistry()
        self._resource_registry = ResourceRegistry()
        self._extension_registry = ExtensionRegistry()

    def list_plugins(self) -> list[PluginApi]:
        return self._plugin_registry.list_plugins()

    def get_plugin(self, plugin_id: str) -> Plugin | None:
        return self._plugin_registry.get_plugin(id=plugin_id)

    def get_plugin_method(self, plugin_id: str, method_name: str):
        return self._plugin_registry.get_method(
            plugin_id=plugin_id, method_name=method_name
        )

    def get_resource_instance(
        self, resource: ResourceStore, plugin_id: str | None = None
    ) -> Resource | None:
        id = plugin_id
        if resource.source and not plugin_id:
            plugin = self._plugin_registry.get_plugin_by_name(
                name=resource.source["plugin_name"], version=resource.source["version"]
            )
            id = plugin[0] if plugin else None

        ResourceClass = self._resource_registry.get_resource_class(
            resource.type, plugin_id=id
        )

        return ResourceClass(**resource.data) if ResourceClass else None

    def get_extension_descriptions(self):
        return self._extension_registry.get_extension_description()

    def get_loaded_extensions(self):
        return self._extension_registry.get_loaded_extensions()

    def load_plugins(self, plugin_ids: list[str]) -> list[str]:
        loaded_plugins = []

        for id in plugin_ids:
            module_path = config.PLUGIN_DIR / id
            if not (module_path / "__init__.py").exists():
                shutil.rmtree(module_path, ignore_errors=True)
                continue

            if id in sys.modules:
                continue

            spec = importlib.util.spec_from_file_location(
                id, module_path / "__init__.py"
            )

            try:
                if spec and spec.loader:
                    module = importlib.util.module_from_spec(spec)
                    sys.modules[id] = module
                    spec.loader.exec_module(module)
                    try:
                        plugin = self._plugin_registry.register(module)

                        if not plugin:
                            print("plugin not found")
                            raise Exception()

                        self._extension_registry.register(module)
                        for method in plugin.method_map().values():
                            for resource_type in method._resource_types:
                                self._resource_registry.register_resource(
                                    id, resource_type
                                )

                        loaded_plugins.append(id)
                    except Exception as e:
                        self.unload_plugins([id])
                        raise e
                else:
                    raise Exception()
            except Exception as e:
                shutil.rmtree(module_path, ignore_errors=True)

        return loaded_plugins

    def unload_plugins(self, plugin_ids: list[str]):
        for id in plugin_ids:
            self._plugin_registry.unload_module(id)
            self._extension_registry.unload_module(id)
            self._resource_registry.unload_module(id)


registry_manager = RegistryManager()
