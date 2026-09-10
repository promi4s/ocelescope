import traceback
from typing import (
    TYPE_CHECKING,
    Any,
    Generic,
    Hashable,
    ParamSpec,
)

from typing_extensions import TypedDict

from ocelescope import OCEL, BaseFilter, Resource
from ocelescope_backend.app.internal.registry import registry_manager
from ocelescope_backend.app.internal.registry.plugin import PluginNotFound
from ocelescope_backend.app.internal.tasks.base import (
    TaskBase,
    TaskState,
    TaskSummary,
    call_with_known_params,
)
from ocelescope_backend.app.internal.util.hashing import generate_tuple_hash
from ocelescope_backend.app.sse_manager import (
    ErrorNotification,
    PluginLink,
    SystemNotification,
    sse_manager,
)

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
        self, plugin_id: str, method_name: str, session: "Session", input: PluginInput
    ):
        super().__init__()
        self.plugin_id = plugin_id
        self.method_name = method_name
        self.input = input
        self.result: list[OCEL | Resource] | None = None
        self.session = session

    def run(self):
        self.state = TaskState.STARTED
        try:
            plugin = registry_manager.get_plugin(self.plugin_id)

            if plugin is None:
                raise PluginNotFound(self.plugin_id)

            method = registry_manager.get_plugin_method(
                self.plugin_id, self.method_name
            )

            kwargs = registry_manager.get_plugin_method_kwargs(
                session=self.session,
                plugin_id=self.plugin_id,
                method_name=self.method_name,
                input_resources=self.input["input_resources"],
            )

            if method.configuration_input is not None:
                kwargs["input"] = method.configuration_input(**self.input["input"])

            result = call_with_known_params(method.bind(plugin), **kwargs)

            returned = result if isinstance(result, tuple) else (result,)

            entities: list[OCEL | Resource] = []

            for item in returned:
                if isinstance(item, list):
                    entities.extend(item)
                else:
                    entities.append(item)

            self.result = entities

            if self.state != TaskState.CANCELLED:
                self.state = TaskState.SUCCESS

                sse_manager.send_safe(
                    session_id=self.session.id,
                    message=SystemNotification(
                        type="notification",
                        title="Plugin successfully run",
                        message=f"Successfully run plugin {self.plugin_id} {self.method_name}",
                        notification_type="info",
                        link=PluginLink(
                            type="plugin",
                            method=self.method_name,
                            id=self.plugin_id,
                            task_id=self.id,
                        ),
                    ),
                )

        except Exception as e:
            self.error = e
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
            self.session.running_tasks.pop(self.id, None)

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
        filter: dict[str, list[BaseFilter]],
    ) -> Hashable:
        return generate_tuple_hash("plugin", plugin_name, method_name, input, filter)

    @classmethod
    def create_plugin_task(
        cls,
        session: "Session",
        plugin_id: str,
        method_name: str,
        input: PluginInput,
    ) -> str:
        method = registry_manager.get_plugin_method(plugin_id, method_name)

        ocel_fields = [input.name for input in method.inputs if input.io_type == "ocel"]

        filters = {
            field_name: session.get_filter(input_id)
            for field_name, input_id in input["input_resources"].items()
            if input_id is not None and field_name in ocel_fields
        }

        key = cls._dedupe_key(plugin_id, method_name, input, filters)

        existing_id = session._dedupe_keys.get(key)
        if existing_id and existing_id in session.tasks:
            print(
                f"[Task: {plugin_id} {method_name}] Skipped (deduplicated) -> {existing_id}"
            )
            return existing_id

        task = cls(
            session=session,
            plugin_id=plugin_id,
            method_name=method_name,
            input=input,
        )
        session.tasks[task.id] = task
        session.running_tasks[task.id] = task
        session._dedupe_keys[key] = task.id

        print(f"[Task] Starting in thread (ID: {task.id})")
        task.start()
        return task.id
