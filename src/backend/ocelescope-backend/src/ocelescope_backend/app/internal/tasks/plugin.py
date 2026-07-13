import traceback
from copy import deepcopy
from typing import (
    TYPE_CHECKING,
    Any,
    Generic,
    Hashable,
    ParamSpec,
)

from typing_extensions import TypedDict

from ocelescope import OCEL, Resource
from ocelescope_backend.app.internal.registry import registry_manager
from ocelescope_backend.app.internal.tasks.base import (
    TaskBase,
    TaskState,
    TaskSummary,
    _call_with_known_params,
)
from ocelescope_backend.app.internal.util.hashing import generate_tuple_hash
from ocelescope_backend.app.internal.ocel.filters import ModuleFilter
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
    ocels: dict[str, str]
    resources: dict[str, str]
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
            method = registry_manager.get_plugin_method(
                self.plugin_id, self.method_name
            )

            ocel_args: dict[str, OCEL] = {
                key: deepcopy(self.session.get_ocel(self.input["ocels"][key]))
                for key in method.input_ocels.keys()
            }

            resource_args: dict[str, Resource] = {}

            # TODO: Find a better way to do this
            for key in method.input_resources.keys():
                resource_instance = registry_manager.get_resource_instance(
                    self.session.get_resource(self.input["resources"][key])
                )

                if resource_instance:
                    resource_args[key] = resource_instance

            kwargs = {
                **ocel_args,
                **resource_args,
            }

            if method._input_model is not None:
                kwargs["input"] = method._input_model(**self.input["input"])

            result = _call_with_known_params(method._method, **kwargs)

            self.result = []

            if not isinstance(result, tuple):
                result = (result,)

            for item in result:
                if not isinstance(item, list):
                    item = [item]

                for entity in item:
                    self.result.append(entity)

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
        filter: dict[str, list[ModuleFilter]],
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
        filters = {
            ocel_id: session.get_filter(ocel_id) for ocel_id in input["ocels"].values()
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
