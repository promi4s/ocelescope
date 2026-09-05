from contextlib import ExitStack, contextmanager
from copy import deepcopy
from types import ModuleType
from typing import TYPE_CHECKING, Any, Iterator, Optional, TypedDict

from ocelescope.plugin.decorators import PluginIO

from ocelescope import OCEL, Plugin, PluginMethod, Resource
from ocelescope_backend.app.internal.model.plugin import PluginApi
from ocelescope_backend.app.internal.registry.resource import RegistryError

if TYPE_CHECKING:
    from ocelescope_backend.app.internal.session import Session


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

        if any(
            plugin.get_name() == existing_plugin.get_name()
            and plugin.version == existing_plugin.version
            for existing_plugin in self._registry.values()
        ):
            raise PluginAlreadyRegistered(
                name=plugin.get_name(), version=plugin.version
            )

        self._registry[module.__name__] = plugin()
        return self._registry[module.__name__]

    def list_plugins(self) -> list[PluginApi]:
        return [
            PluginApi.from_plugin(id, plugin) for id, plugin in self._registry.items()
        ]

    def get_plugin(self, id: str) -> Optional[Plugin]:
        return self._registry.get(id)

    def get_method(self, plugin_id: str, method_name: str) -> PluginMethod:
        plugin = self.get_plugin(plugin_id)
        if plugin is None:
            raise PluginNotFound(plugin_id)

        method = plugin.method_map()[method_name]

        return method

    def _resolve_plugin_input(
        self,
        session: "Session",
        io: PluginIO,
        input_resources: dict[str, str | None],
        ocel_stack: ExitStack | None = None,
    ) -> Resource | OCEL | None:
        id = input_resources.get(io.name, None)

        if not id:
            return

        if io.io_type == "ocel":
            ocel = session.get_ocel(id)

            if ocel_stack is not None:
                return ocel_stack.enter_context(ocel)

            with ocel:
                return deepcopy(ocel)

        return io.type(**session.get_resource(id).data)

    def get_plugin_kwargs(
        self,
        session: "Session",
        plugin_id: str,
        method_name: str,
        input_resources: dict[str, str | None],
        ocel_stack: ExitStack | None = None,
    ) -> dict[str, Any]:

        method = self.get_method(plugin_id, method_name)

        kwargs: dict[str, Any] = {
            input.name: self._resolve_plugin_input(
                session, input, input_resources, ocel_stack
            )
            for input in method.inputs
        }

        return kwargs

    @contextmanager
    def computed_kwargs(
        self,
        session: "Session",
        plugin_id: str,
        method_name: str,
        input_resources: dict[str, str | None],
    ) -> Iterator[dict[str, Any]]:
        """Kwargs for a computed-value provider, valid for the block.

        A provider only reads, so its OCELs are the session's own read-only view
        rather than a copy of the whole log -- they are closed when the block
        exits and must not outlive it.
        """
        with ExitStack() as ocel_stack:
            yield self.get_plugin_kwargs(
                session=session,
                plugin_id=plugin_id,
                method_name=method_name,
                input_resources=input_resources,
                ocel_stack=ocel_stack,
            )

    def unload_module(self, id: str):
        self._registry.pop(id, None)
