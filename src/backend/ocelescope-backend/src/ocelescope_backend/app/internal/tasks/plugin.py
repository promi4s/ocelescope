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

from ocelescope import OCEL, BaseFilter, Resource
from ocelescope_backend.app.internal.registry import registry_manager
from ocelescope_backend.app.internal.tasks.base import (
    TaskBase,
    TaskState,
    TaskSummary,
    _call_with_known_params,
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
    ocels: dict[str, str | None]
    resources: dict[str, str | None]
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

    @staticmethod
    def _selected_id(
        supplied: dict[str, str | None], key: str, is_optional: bool
    ) -> str | None:
        """The id picked for a declared input, or `None` when it may be left empty.

        A cleared field arrives as `null` rather than as a missing key, so both count
        as "not selected". A required input that is missing is reported by name, rather
        than reaching the plugin as a `None` that fails somewhere in its body.
        """
        selected = supplied.get(key) or None

        if selected is None and not is_optional:
            raise ValueError(f"Missing required input: {key}")

        return selected

    def _copy_session_ocel(self, ocel_id: str) -> OCEL:
        """An in-memory copy of a session OCEL, for the plugin to do as it likes with."""
        with self.session.get_ocel(ocel_id) as session_ocel:
            return deepcopy(session_ocel)

    def run(self):
        self.state = TaskState.STARTED
        try:
            method = registry_manager.get_plugin_method(
                self.plugin_id, self.method_name
            )

            ocel_args: dict[str, OCEL | None] = {}

            for key, annotation in method.input_ocels.items():
                ocel_id = self._selected_id(
                    self.input["ocels"], key, annotation.is_optional
                )

                ocel_args[key] = (
                    self._copy_session_ocel(ocel_id) if ocel_id is not None else None
                )

            resource_args: dict[str, Resource | None] = {}

            # TODO: Find a better way to do this
            for key, (_, annotation) in method.input_resources.items():
                resource_id = self._selected_id(
                    self.input["resources"], key, annotation.is_optional
                )

                resource_args[key] = (
                    registry_manager.get_resource_instance(
                        self.session.get_resource(resource_id).data,
                        source_id=self.plugin_id,
                    )
                    if resource_id is not None
                    else None
                )

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
        filters = {
            ocel_id: session.get_filter(ocel_id)
            for ocel_id in input["ocels"].values()
            if ocel_id
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
