import traceback
from collections.abc import Hashable
from typing import (
    TYPE_CHECKING,
    Any,
    Generic,
    ParamSpec,
)

from ocelescope_backend.app.internal.registry import resource_registry
from ocelescope_backend.app.internal.tasks.base import (
    TaskBase,
    TaskState,
    TaskSummary,
    call_with_known_params,
)
from ocelescope_backend.app.sse_manager import (
    ErrorNotification,
    sse_manager,
)
from typing_extensions import TypedDict

from ocelescope import OCEL, ResourceBase
from ocelescope_module_plugin.hashing import generate_tuple_hash
from ocelescope_module_plugin.registry import PluginNotFound, PluginRegistry

if TYPE_CHECKING:
    from ocelescope_backend.app.internal.session import Session

P = ParamSpec("P")


class PluginInput(TypedDict):
    input_resources: dict[str, str | None]
    input: dict[str, Any]


class PluginTaskSummary(TaskSummary):
    plugin_id: str
    method_name: str


class PluginTask(TaskBase, Generic[P]):
    def __init__(
        self,
        plugin_id: str,
        method_name: str,
        method_label: str,
        session: "Session",
        input: PluginInput,
        registry: PluginRegistry,
    ):
        super().__init__()
        self.registry = registry
        self.plugin_id = plugin_id
        self.method_name = method_name
        self.method_label = method_label
        self.input = input
        self.session = session

    def _discard_outputs(self) -> None:
        session = self.session
        for ocel in session.list_ocels(source_id=self.id, include_hidden=True):
            session.delete_ocel(ocel.id)
        for resource in session.list_resources(source_id=self.id, include_hidden=True):
            session.delete_resource(resource.id)

    def run(self):
        self.state = TaskState.STARTED
        kwargs: dict[str, Any] = {}
        entities: list[OCEL | ResourceBase] = []
        try:
            plugin = self.registry.get_plugin(self.plugin_id)

            if plugin is None:
                raise PluginNotFound(self.plugin_id)

            method = self.registry.get_method(self.plugin_id, self.method_name)

            kwargs = self.registry.get_plugin_kwargs(
                session=self.session,
                plugin_id=self.plugin_id,
                method_name=self.method_name,
                input_resources=self.input["input_resources"],
            )

            if method.configuration_input is not None:
                kwargs["input"] = method.configuration_input(**self.input["input"])

            result = call_with_known_params(method.bind(plugin), **kwargs)

            returned = result if isinstance(result, tuple) else (result,)

            for item in returned:
                if isinstance(item, list):
                    entities.extend(item)
                else:
                    entities.append(item)

            for index, entity in enumerate(entities):
                name = f"{plugin.get_name()}_{self.method_name}_{index}"
                if isinstance(entity, OCEL):
                    self.session.add_ocel(entity, name, source_id=self.id, hidden=True)
                else:
                    resource_registry.get_resource_class(entity.get_schema_hash())
                    self.session.add_resource(
                        entity, name, source_id=self.id, hidden=True
                    )

            if self.state != TaskState.CANCELLED:
                self.state = TaskState.SUCCESS

        except Exception as e:
            self.error = e
            self._discard_outputs()
            self.state = TaskState.FAILURE
            sse_manager.send_safe(
                session_id=self.session.id,
                message=ErrorNotification(
                    type="error",
                    title=f"Error while running plugin {self.plugin_id} {self.method_name}",
                    message=str(e),
                    trace=traceback.format_exc(),
                ),
            )
        finally:
            for value in [*kwargs.values(), *entities]:
                if isinstance(value, OCEL | ResourceBase):
                    value.close()

    def summarize(self) -> PluginTaskSummary:
        return PluginTaskSummary(
            id=self.id,
            plugin_id=self.plugin_id,
            method_name=self.method_name,
            state=self.state,
        )

    @staticmethod
    def _dedupe_key(
        plugin_name: str,
        method_name: str,
        input: PluginInput,
        views: dict[str, str | None],
    ) -> Hashable:
        return generate_tuple_hash("plugin", plugin_name, method_name, input, views)

    @classmethod
    def create_plugin_task(
        cls,
        session: "Session",
        registry: PluginRegistry,
        plugin_id: str,
        method_name: str,
        input: PluginInput,
    ) -> str:
        method = registry.get_method(plugin_id, method_name)

        ocel_fields = [input.name for input in method.inputs if input.io_type == "ocel"]

        views = {
            field_name: session.get_ocel(input_id).active_view_id
            for field_name, input_id in input["input_resources"].items()
            if input_id is not None and field_name in ocel_fields
        }

        key = cls._dedupe_key(plugin_id, method_name, input, views)

        existing_id = session._dedupe_keys.get(key)
        existing_task = session.tasks.get(existing_id) if existing_id else None
        if existing_id and existing_task and existing_task.state != TaskState.FAILURE:
            print(
                f"[Task: {plugin_id} {method_name}] Skipped (deduplicated) -> {existing_id}"
            )
            return existing_id

        task = cls(
            session=session,
            plugin_id=plugin_id,
            method_name=method_name,
            method_label=method.label,
            input=input,
            registry=registry,
        )
        session.tasks[task.id] = task
        session._dedupe_keys[key] = task.id

        print(f"[Task] Starting in thread (ID: {task.id})")
        task.start()
        return task.id
