from typing import (
    TYPE_CHECKING,
    Any,
    Generic,
    Hashable,
    ParamSpec,
    TypedDict,
)

from ocelescope import OCELFilter
from ocelescope.ocel.ocel import OCEL
from ocelescope.resource.resource import Resource
from pydantic.fields import Field
from pydantic.main import BaseModel

from app.internal.model.resource import ResourceStore
from app.internal.registry import registry_manager
from app.internal.tasks.base import (
    TaskBase,
    TaskState,
    TaskSummary,
    _call_with_known_params,
)
from app.internal.util.hashing import generate_tuple_hash
from app.websocket import (
    PluginLink,
    SytemNotificiation,
    websocket_manager,
)

if TYPE_CHECKING:
    from app.internal.session import Session

P = ParamSpec("P")


class PluginInput(TypedDict):
    ocels: dict[str, str]
    resources: dict[str, str]
    input: dict[str, Any]


class PluginOutput(BaseModel):
    ocel_ids: list[str] = Field(default=[])
    resource_ids: list[str] = Field(default=[])


class PluginTaskSummary(TaskSummary):
    plugin_id: str
    method_name: str
    output: PluginOutput


class PluginTask(TaskBase, Generic[P]):
    def __init__(
        self, plugin_id: str, method_name: str, session: "Session", input: PluginInput
    ):
        super().__init__()
        self.plugin_id = plugin_id
        self.method_name = method_name
        self.input = input
        self.result: PluginOutput = PluginOutput()

        self.session = session

    def run(self):
        self.state = TaskState.STARTED
        try:
            plugin = registry_manager.get_plugin(plugin_id=self.plugin_id)
            method = registry_manager.get_plugin_method(
                self.plugin_id, self.method_name
            )

            ocel_args: dict[str, OCEL] = {
                key: self.session.get_ocel(self.input["ocels"][key])
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

            if not isinstance(result, tuple):
                result = (result,)

            for item_index, item in enumerate(result):
                if not isinstance(item, list):
                    item = [item]

                for entitiy_index, entitiy in enumerate(item):
                    if isinstance(entitiy, OCEL):
                        self.result.ocel_ids.append(self.session.add_ocel(entitiy))
                    if isinstance(entitiy, Resource):
                        self.result.resource_ids.append(
                            self.session.add_resource(
                                ResourceStore(
                                    name=f"{plugin.meta().name if plugin else self.plugin_id}_{self.method_name}_{item_index}_{entitiy_index}",
                                    type=entitiy.get_type(),
                                    source={
                                        "task_id": self.id,
                                        "method_name": self.method_name,
                                        "plugin_name": plugin.meta().name,
                                        "version": "",
                                    }
                                    if plugin
                                    else None,
                                    data=entitiy.model_dump(),
                                ),
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

    def summarize(self) -> PluginTaskSummary:
        return PluginTaskSummary(
            id=self.id,
            plugin_id=self.plugin_id,
            method_name=self.method_name,
            state=self.state,
            output=self.result,
        )

    @staticmethod
    def _dedupe_key(
        plugin_name: str,
        method_name: str,
        input: PluginInput,
        filter: dict[str, OCELFilter | None],
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
            ocel_id: session.get_ocel_filters(ocel_id)
            for ocel_id in input["ocels"].values()
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
