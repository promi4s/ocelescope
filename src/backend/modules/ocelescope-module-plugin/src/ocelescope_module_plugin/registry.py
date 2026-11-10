import importlib.util
import shutil
import sys
from collections.abc import Generator
from contextlib import ExitStack, contextmanager
from pathlib import Path
from types import ModuleType
from typing import TYPE_CHECKING, Any

from ocelescope.plugin.decorators import PluginIO
from ocelescope_backend.app.internal.exceptions import BadRequest
from ocelescope_backend.app.internal.registry.resource import RegistryError

from ocelescope import OCEL, Plugin, PluginMethod, ResourceBase
from ocelescope_module_plugin.dynamic_import import (
    import_wheel_dynamically,
    is_wheel_compatible,
)
from ocelescope_module_plugin.models.plugin import PluginApi
from ocelescope_module_plugin.plugin_inputs import ResourceArg, match_resource_class

if TYPE_CHECKING:
    from ocelescope_backend.app.internal.session import Session
    from ocelescope_backend.app.modules.context import ModuleRegistry


class PluginNotFound(RegistryError):
    """Raised when no plugin could be found for a lookup.

    Attributes:
        plugin_id: The registry id or module name the plugin was looked for in.
    """

    def __init__(self, plugin_id: str):
        self.plugin_id = plugin_id
        super().__init__(f"No plugin found for {plugin_id!r}")


class MethodNotFound(RegistryError):
    """Raised when a plugin has no method under the requested name.

    Attributes:
        plugin_id: The registry id of the plugin that was looked in.
        method_name: The method name that was looked for.
    """

    def __init__(self, plugin_id: str, method_name: str):
        self.plugin_id = plugin_id
        self.method_name = method_name
        super().__init__(f"Plugin {plugin_id!r} has no method {method_name!r}")


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


def find_plugin_class(module: ModuleType) -> type[Plugin]:
    plugin_class = next(
        (
            var
            for var in vars(module).values()
            if isinstance(var, type) and issubclass(var, Plugin) and var is not Plugin
        ),
        None,
    )

    if plugin_class is None:
        raise PluginNotFound(module.__name__)

    return plugin_class


def import_plugin_module(plugin_dir: Path, id: str) -> ModuleType:
    if id in sys.modules:
        return sys.modules[id]

    module_path = plugin_dir / id

    # TODO: Put wheels folder into config
    if (module_path / "wheels").exists():
        for wheel in (module_path / "wheels").iterdir():
            if wheel.suffix == ".whl" and is_wheel_compatible(wheel.name):
                import_wheel_dynamically(wheel)

    spec = importlib.util.spec_from_file_location(id, module_path / "__init__.py")
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not create module spec for plugin {id!r}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[id] = module
    try:
        spec.loader.exec_module(module)
    except Exception:
        sys.modules.pop(id, None)
        raise
    return module


class PluginRegistry:
    BASE_PLUGIN_ID: str = "__BASE_PLUGIN_ID__"

    def __init__(self, module_registry: "ModuleRegistry"):
        self._registry: dict[str, Plugin] = {}
        self._module_registry = module_registry

    def add_plugin(self, id: str, plugin_class: type[Plugin]) -> Plugin:
        if any(
            plugin_class.get_name() == existing_plugin.get_name()
            and plugin_class.version == existing_plugin.version
            for existing_plugin in self._registry.values()
        ):
            raise PluginAlreadyRegistered(
                name=plugin_class.get_name(), version=plugin_class.version
            )

        self._registry[id] = plugin_class()
        self._module_registry.load(plugin_class.get_resources(), namespace=id)

        return self._registry[id]

    def load_from_dir(
        self, plugin_dir: Path, plugin_ids: list[str], ignore_errors: bool = True
    ) -> list[str]:
        loaded_plugins = []

        for id in plugin_ids:
            module_path = plugin_dir / id
            if not (module_path / "__init__.py").exists():
                shutil.rmtree(module_path, ignore_errors=True)
                continue

            if id in sys.modules:
                continue

            try:
                module = import_plugin_module(plugin_dir, id)
                try:
                    self.add_plugin(id, find_plugin_class(module))
                    loaded_plugins.append(id)
                except Exception:
                    self.unload_module(id)
                    raise
            except Exception:
                shutil.rmtree(module_path, ignore_errors=True)

                if not ignore_errors:
                    raise

        return loaded_plugins

    def list_plugins(self) -> list[PluginApi]:
        return [
            PluginApi.from_plugin(id, plugin) for id, plugin in self._registry.items()
        ]

    def get_plugin(self, id: str) -> Plugin | None:
        return self._registry.get(id)

    def get_method(self, plugin_id: str, method_name: str) -> PluginMethod:
        plugin = self.get_plugin(plugin_id)
        if plugin is None:
            raise PluginNotFound(plugin_id)

        method = plugin.method_map().get(method_name)

        if method is None:
            raise MethodNotFound(plugin_id, method_name)

        return method

    @staticmethod
    def _resource_class(
        session: "Session", io: PluginIO, id: str
    ) -> type[ResourceBase]:
        resource_class = match_resource_class(io, session.get_resource(id).schema_hash)
        if resource_class is None:
            raise BadRequest(
                f"Resource {id} cannot be passed as {io.name!r}: expected "
                + " or ".join(t.__name__ for t in io.resource_types)
            )
        return resource_class

    def task_inputs(
        self,
        session: "Session",
        plugin_id: str,
        method_name: str,
        input_resources: dict[str, str | None],
    ) -> dict[str, OCEL | ResourceArg | None]:
        method = self.get_method(plugin_id, method_name)
        inputs: dict[str, OCEL | ResourceArg | None] = {}
        missing: list[str] = []

        for io in method.inputs:
            id = input_resources.get(io.name)
            if not id:
                inputs[io.name] = None
                if not io.is_optional:
                    missing.append(io.name)
            elif io.io_type == "ocel":
                inputs[io.name] = session.ocel_input(id)
            else:
                self._resource_class(session, io, id)
                store = session.get_resource(id)
                inputs[io.name] = ResourceArg(store.path, store.schema_hash)

        if missing:
            raise BadRequest(f"Missing required input: {', '.join(missing)}")

        return inputs

    @contextmanager
    def computed_kwargs(
        self,
        session: "Session",
        plugin_id: str,
        method_name: str,
        input_resources: dict[str, str | None],
    ) -> Generator[dict[str, Any]]:
        """Kwargs for a computed-value provider, valid for the block.

        A provider only reads, so its OCELs and resources are read-only views
        rather than in-memory copies -- they are closed when the block
        exits and must not outlive it. Inputs are not required to be filled in
        yet either: the form the provider computes a field for is still open.
        """
        method = self.get_method(plugin_id, method_name)
        with ExitStack() as input_stack:
            kwargs: dict[str, Any] = {}
            for io in method.inputs:
                id = input_resources.get(io.name)
                if not id:
                    kwargs[io.name] = None
                elif io.io_type == "ocel":
                    kwargs[io.name] = input_stack.enter_context(
                        session.get_ocel(id).open()
                    )
                else:
                    kwargs[io.name] = input_stack.enter_context(
                        session.open_resource(id, self._resource_class(session, io, id))
                    )
            yield kwargs

    def unload_module(self, id: str):
        self._registry.pop(id, None)
        self._module_registry.unload(namespace=id)
