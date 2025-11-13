import importlib.util
import shutil
import sys
from typing import Any, Dict, TypedDict

from ocelescope import Plugin, Resource

from app.internal.config import config
from app.internal.model.plugin import PluginApi
from app.internal.model.resource import ResourceStore
from app.internal.registry.extension import ExtensionRegistry
from app.internal.registry.plugin import PluginRegistry
from app.internal.registry.resource import ResourceRegistry
from app.internal.util.dynamic_import import (
    import_wheel_dynamically,
    is_wheel_compatible,
)


class ResourceInfo(TypedDict):
    label: str
    description: str | None


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

    def _hydrate(self, data: Any, plugin_id: str | None = None):
        if isinstance(data, dict) and "_ocelescope_resource_type" in data:
            ResourceClass = self._resource_registry.get_resource_class(
                data["_ocelescope_resource_type"], plugin_id=plugin_id
            )
            if ResourceClass:
                hydrated = {
                    k: self._hydrate(v, plugin_id)
                    for k, v in data.items()
                    if k != "type"
                }
                return ResourceClass(**hydrated)
        elif isinstance(data, dict):
            return {k: self._hydrate(v, plugin_id) for k, v in data.items()}
        elif isinstance(data, list):
            return [self._hydrate(item, plugin_id) for item in data]
        else:
            return data

    def get_resource_instance(
        self, resource: ResourceStore, plugin_id: str | None = None
    ) -> Resource | None:
        id = plugin_id
        if resource.source and not plugin_id:
            plugin = self._plugin_registry.get_plugin_by_name(
                name=resource.source["plugin_name"], version=resource.source["version"]
            )
            id = plugin[0] if plugin else None

        hydrated_resource = self._hydrate(resource.data, id)

        assert isinstance(hydrated_resource, Resource)

        return hydrated_resource

    def get_extension_descriptions(self):
        return self._extension_registry.get_extension_description()

    def get_loaded_extensions(self):
        return self._extension_registry.get_loaded_extensions()

    def load_plugins(self, plugin_ids: list[str]) -> list[str]:
        if not config.PLUGIN_DIR:
            raise RuntimeError("Plugin directory is not set")

        loaded_plugins = []

        for id in plugin_ids:
            module_path = config.PLUGIN_DIR / id
            if not (module_path / "__init__.py").exists():
                shutil.rmtree(module_path, ignore_errors=True)
                continue

            if id in sys.modules:
                continue

            # TODO: Put wheels folder into config
            if (module_path / "wheels").exists():
                compatible_wheels = [
                    wheel_file
                    for wheel_file in (module_path / "wheels").iterdir()
                    if is_wheel_compatible(wheel_file.name)
                ]

                for wheel in compatible_wheels:
                    import_wheel_dynamically(wheel)

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
            except Exception:
                shutil.rmtree(module_path, ignore_errors=True)

        return loaded_plugins

    def unload_plugins(self, plugin_ids: list[str]):
        for id in plugin_ids:
            self._plugin_registry.unload_module(id)
            self._extension_registry.unload_module(id)
            self._resource_registry.unload_module(id)

    def get_resource_info(self) -> Dict[str, ResourceInfo]:
        return {
            key: {"label": resource.label or key, "description": resource.description}
            for key, resource in self._resource_registry.resources.items()
        }


registry_manager = RegistryManager()
