from typing import (
    TYPE_CHECKING,
    Any,
    Generic,
    Hashable,
    ParamSpec,
    TypedDict,
)

from pydantic.fields import Field
from pydantic.main import BaseModel

from tasks.base import TaskSummary, _call_with_known_params
from ocelescope.ocel.ocel import OCEL
from ocelescope.resource.resource import Resource

from api.websocket import (
    PluginLink,
    SytemNotificiation,
    websocket_manager,
)

from registry.plugin import plugin_registy

from tasks.base import TaskBase, TaskState, make_hashable

if TYPE_CHECKING:
    from api.session import Session

P = ParamSpec("P")


class PluginTaskSummary(TaskSummary):
    plugin_name: str
    method_name: str


class PluginInput(TypedDict):
    ocels: dict[str, str]
    resources: dict[str, str]
    input: dict[str, Any]


class PluginOutput(BaseModel):
    ocel_ids: list[str] = Field(default=[])
    resource_ids: list[str] = Field(default=[])


class PluginTask(TaskBase, Generic[P]):
    def __init__(
        self, plugin_name: str, method_name: str, session: "Session", input: PluginInput
    ):
        # TaskBase in your setup expects (fn, args, kwargs)
        super().__init__()
        self.plugin_name = plugin_name
        self.method_name = method_name
        self.input = input
        self.result: PluginOutput = PluginOutput()

        self.session = session

    def run(self):
        self.state = TaskState.STARTED
        try:
            method = plugin_registy.get_method(self.plugin_name, self.method_name)

            ocel_args: dict[str, OCEL] = {
                key: self.session.get_ocel(self.input["ocels"][key])
                for key in method.input_ocels.keys()
            }

            resource_args: dict[str, Resource] = {
                key: self.session.get_resource(self.input["resources"][key]).resource
                for key in method.input_resources.keys()
            }

            kwargs = {
                **ocel_args,
                **resource_args,
            }

            if method._input_model is not None:
                kwargs["input"] = method._input_model(**self.input["input"])

            result = _call_with_known_params(method._method, **kwargs)

            if not isinstance(result, tuple):
                result = (result,)

            for item_index, item in enumerate(result):
                if not isinstance(item, list):
                    item = [item]

                for entitiy_index, entitiy in enumerate(item):
                    if isinstance(entitiy, OCEL):
                        self.result.ocel_ids.append(self.session.add_ocel(entitiy))
                    if isinstance(entitiy, Resource):
                        self.result.ocel_ids.append(
                            self.session.add_resource(
                                entitiy,
                                name=f"{self.plugin_name}_{self.method_name}_{item_index}_{entitiy_index}",
                            )
                        )

            if self.state != TaskState.CANCELLED:
                self.state = TaskState.SUCCESS
        except Exception as exc:
            self.error = exc
            self.state = TaskState.FAILURE
            raise
        finally:
            self.session.running_tasks.pop(self.id, None)
            websocket_manager.send_safe(
                session_id=self.session.id,
                message=SytemNotificiation(
                    type="notification",
                    title="Plugin successfully run",
                    message=f"Successfully run plugin {self.plugin_name} {self.method_name}",
                    notification_type="info",
                    link=PluginLink(
                        type="plugin",
                        method=self.method_name,
                        name=self.plugin_name,
                        task_id=self.id,
                    ),
                ),
            )

    def summarize(self) -> PluginTaskSummary:
        return PluginTaskSummary(
            id=self.id,
            plugin_name=self.plugin_name,
            method_name=self.method_name,
            state=self.state,
        )

    @staticmethod
    def _dedupe_key(plugin_name: str, method_name: str, input: PluginInput) -> Hashable:
        return ("plugin", plugin_name, method_name, make_hashable(input))

    @classmethod
    def create_plugin_task(
        cls,
        session: "Session",
        plugin_name: str,
        method_name: str,
        input: PluginInput,
    ) -> str:
        key = cls._dedupe_key(plugin_name, method_name, input)

        existing_id = session._dedupe_keys.get(key)
        if existing_id and existing_id in session.tasks:
            print(
                f"[Task: {plugin_name} {method_name}] Skipped (deduplicated) -> {existing_id}"
            )
            return existing_id

        task = cls(
            session=session,
            plugin_name=plugin_name,
            method_name=method_name,
            input=input,
        )
        session.tasks[task.id] = task
        session.running_tasks[task.id] = task
        session._dedupe_keys[key] = task.id

        print(f"[Task] Starting in thread (ID: {task.id})")
        task.start()
        return task.id
