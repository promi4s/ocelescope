import importlib.util
import shutil
import sys
from contextlib import AbstractContextManager
from typing import TYPE_CHECKING, Any, Dict

from typing_extensions import TypedDict

from ocelescope import Plugin, Resource
from ocelescope_backend.app.internal.config import config
from ocelescope_backend.app.internal.model.plugin import PluginApi
from ocelescope_backend.app.internal.registry.plugin import PluginRegistry
from ocelescope_backend.app.internal.registry.resource import ResourceRegistry
from ocelescope_backend.app.internal.util.dynamic_import import (
    import_wheel_dynamically,
    is_wheel_compatible,
)

if TYPE_CHECKING:
    from ocelescope_backend.app.internal.session import Session


class ResourceInfo(TypedDict):
    label: str
    description: str | None


class RegistryManager:
    def __init__(self):
        self._plugin_registry = PluginRegistry()
        self._resource_registry = ResourceRegistry()

    def list_plugins(self) -> list[PluginApi]:
        return self._plugin_registry.list_plugins()

    def get_plugin(self, plugin_id: str) -> Plugin | None:
        return self._plugin_registry.get_plugin(id=plugin_id)

    def get_plugin_method(self, plugin_id: str, method_name: str):
        return self._plugin_registry.get_method(
            plugin_id=plugin_id, method_name=method_name
        )

    def get_plugin_method_kwargs(
        self,
        session: "Session",
        plugin_id: str,
        method_name: str,
        input_resources: dict[str, str | None],
    ) -> dict[str, Any]:

        return self._plugin_registry.get_plugin_kwargs(
            session=session,
            plugin_id=plugin_id,
            method_name=method_name,
            input_resources=input_resources,
        )

    def get_computed_kwargs(
        self,
        session: "Session",
        plugin_id: str,
        method_name: str,
        input_resources: dict[str, str | None],
    ) -> AbstractContextManager[dict[str, Any]]:
        """Kwargs for a computed-value provider; its OCELs live for the block."""
        return self._plugin_registry.computed_kwargs(
            session=session,
            plugin_id=plugin_id,
            method_name=method_name,
            input_resources=input_resources,
        )

    def get_resource_instance(
        self, resource: dict, source_id: str | None = None
    ) -> Resource:
        return self._resource_registry.get_resource_instance(resource, source_id)

    def load_plugins(
        self, plugin_ids: list[str], ignore_errors: bool = True
    ) -> list[str]:
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
                    if wheel_file.suffix == ".whl"
                    and is_wheel_compatible(wheel_file.name)
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

                        for resource_type in plugin.get_resources():
                            self._resource_registry.register_resource(id, resource_type)

                        loaded_plugins.append(id)
                    except Exception:
                        self.unload_plugins([id])
                        raise
                else:
                    raise ImportError(f"Could not create module spec for plugin {id!r}")
            except Exception:
                shutil.rmtree(module_path, ignore_errors=True)

                if not ignore_errors:
                    raise

        return loaded_plugins

    def unload_plugins(self, plugin_ids: list[str]):
        for id in plugin_ids:
            self._plugin_registry.unload_module(id)
            self._resource_registry.unload_module(id)

    def get_resource_info(self) -> Dict[str, ResourceInfo]:
        return {
            schema_hash: next(
                ResourceInfo(label=r.get_label(), description=r.description)
                for r in resource.values()
            )
            for schema_hash, resource in self._resource_registry.resources.items()
        }


registry_manager = RegistryManager()
