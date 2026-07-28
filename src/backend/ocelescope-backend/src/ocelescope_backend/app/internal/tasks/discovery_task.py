from contextlib import ExitStack
from typing import Any, Hashable, Sequence, cast

from ocelescope import Resource, Visualization
from ocelescope_backend.app.internal.exceptions import BadRequest
from ocelescope_backend.app.internal.model.discovery import DiscoveryRequest
from ocelescope_backend.app.internal.model.resource import ResourceStore
from ocelescope_backend.app.internal.registry.registry_manager import registry_manager
from ocelescope_backend.app.internal.session import Session
from ocelescope_backend.app.internal.tasks.base import TaskBase, TaskState, TaskSummary
from ocelescope_backend.app.internal.util.hashing import generate_tuple_hash
from ocelescope_backend.app.sse_manager import (
    SystemNotification,
    sse_manager,
)


class DiscoveryTaskSummary(TaskSummary):
    state: TaskState
    visualization: Visualization | None


class DiscoveryTask(TaskBase):
    def __init__(
        self,
        *,
        session: Session,
        request: DiscoveryRequest,
    ):
        super().__init__()
        self.session = session
        self.request = request
        self.result: Resource | None = None
        self.error: BaseException | None = None
        self._actual_resource_type = request.resource_type

    def run(self):
        self.state = TaskState.STARTED
        try:
            try:
                info = registry_manager.discovery_registry.get(self.request.method_id)
                parameters = info.parse_parameters(
                    cast(dict[str, Any], self.request.parameters)
                )
                # Both the session's OCEL and the filtered one it may be replaced
                # by own a connection, and the discovered resource carries neither
                # past this block -- so the stack closes whichever were opened.
                with ExitStack() as ocels:
                    ocel = ocels.enter_context(
                        self.session.get_ocel(self.request.ocel_id)
                    )
                    if self.request.filters:
                        ocel = ocels.enter_context(ocel.filter(self.request.filters))
                    resource = cast(
                        Resource,
                        info.run(ocel=ocel, parameters=parameters),
                    )
            except KeyError as exc:
                raise BadRequest(str(exc)) from exc

            self.result = resource

            if self.state != TaskState.CANCELLED:
                self.state = TaskState.SUCCESS
        except Exception as exc:
            self.error = exc
            self.state = TaskState.FAILURE
            raise
        finally:
            self.session.running_tasks.pop(self.id, None)
            sse_manager.send_safe(
                self.session.id,
                self._build_notification(),
            )

    def _build_resource_name(self, resource_type: str) -> str:
        ocel_name = self.session.ocels[self.request.ocel_id].name
        return f"{ocel_name}_{resource_type}"

    def _build_notification(self) -> SystemNotification:
        resource_type = self._actual_resource_type
        if self.state == TaskState.SUCCESS:
            return SystemNotification(
                type="notification",
                title="Discovery finished",
                message=(
                    f"Successfully discovered {resource_type} "
                    f"with {self.request.name} "
                    f"for {self.request.ocel_id}"
                ),
                notification_type="info",
            )

        if self.state == TaskState.CANCELLED:
            return SystemNotification(
                type="notification",
                title="Discovery cancelled",
                message=(
                    f"Discovery of {resource_type} "
                    f"with {self.request.name} "
                    f"for {self.request.ocel_id} was cancelled"
                ),
                notification_type="warning",
            )

        error_message = str(self.error) if self.error is not None else "Unknown error"
        return SystemNotification(
            type="notification",
            title="Discovery failed",
            message=error_message,
            notification_type="error",
        )

    def summarize(self) -> DiscoveryTaskSummary:
        return DiscoveryTaskSummary(
            id=self.id,
            state=self.state,
            visualization=cast(Visualization, self.result.visualize())
            if self.result is not None
            else None,
        )

    def save_resource(self):
        if self.result is not None:
            return self.session.add_resource(
                ResourceStore(
                    type=self._actual_resource_type,
                    name=self._build_resource_name(self._actual_resource_type),
                    source=None,
                    data=self.result.model_dump(),
                )
            )

    @staticmethod
    def _dedupe_key(
        *,
        request: DiscoveryRequest,
        filters: Sequence[object],
    ) -> Hashable:
        return generate_tuple_hash("discovery", request, filters)

    @classmethod
    def create_discovery_task(
        cls,
        *,
        session: Session,
        request: DiscoveryRequest,
    ) -> str:
        filters = session.get_filter(request.ocel_id)
        key = cls._dedupe_key(request=request, filters=filters)

        existing_id = session._dedupe_keys.get(key)
        if existing_id and existing_id in session.tasks:
            print(f"[Task: discovery] Skipped (deduplicated) -> {existing_id}")
            return existing_id

        task = cls(
            session=session,
            request=request,
        )
        session.tasks[task.id] = task
        session.running_tasks[task.id] = task
        session._dedupe_keys[key] = task.id

        print(f"[Task: discovery] Starting in thread (ID: {task.id})")
        task.start()
        return task.id
