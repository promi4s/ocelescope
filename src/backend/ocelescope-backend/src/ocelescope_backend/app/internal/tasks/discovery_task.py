from __future__ import annotations

from typing import TYPE_CHECKING, Any, Hashable, Sequence, cast

from ocelescope import Resource
from ocelescope.discovery import discovery_registry
from pydantic import BaseModel, Field

from app.internal.exceptions import BadRequest
from app.internal.model.discovery import DiscoveryRequest
from app.internal.model.resource import ResourceStore
from app.internal.tasks.base import TaskBase, TaskState, TaskSummary
from app.internal.util.hashing import generate_tuple_hash
from app.sse_manager import ResourceLink, SystemNotification, sse_manager

if TYPE_CHECKING:
    from app.internal.session import Session


class DiscoveryOutput(BaseModel):
    resource_ids: list[str] = Field(default_factory=list)


class DiscoveryTaskSummary(TaskSummary):
    ocel_id: str
    method_id: str
    name: str
    resource_type: str
    output: DiscoveryOutput


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
        self.result = DiscoveryOutput()
        self.error: BaseException | None = None
        self._actual_resource_type = request.resource_type

    def run(self):
        self.state = TaskState.STARTED
        try:
            try:
                info = discovery_registry.get(self.request.method_id)
                parameters = info.parse_parameters(cast(dict[str, Any], self.request.parameters))
                resource = cast(
                    Resource,
                    info.run(
                        ocel=self.session.get_ocel(self.request.ocel_id),
                        parameters=parameters,
                    ),
                )
            except KeyError as exc:
                raise BadRequest(str(exc)) from exc

            self._actual_resource_type = resource.get_type()
            resource_id = self.session.add_resource(
                ResourceStore(
                    name=self._build_resource_name(self._actual_resource_type),
                    type=self._actual_resource_type,
                    source=None,
                    data=resource.model_dump(),
                )
            )
            self.result.resource_ids.append(resource_id)

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
        ocel = self.session.get_ocel(self.request.ocel_id)
        ocel_name = ocel.meta.extra.get("name") or ocel.meta.id
        return f"{ocel_name}_{resource_type}"

    def _build_notification(self) -> SystemNotification:
        resource_type = self._actual_resource_type
        if self.state == TaskState.SUCCESS:
            resource_id = (
                self.result.resource_ids[0] if self.result.resource_ids else None
            )
            return SystemNotification(
                type="notification",
                title="Discovery finished",
                message=(
                    f"Successfully discovered {resource_type} "
                    f"with {self.request.name} "
                    f"for {self.request.ocel_id}"
                ),
                notification_type="info",
                link=ResourceLink(resource_id=resource_id) if resource_id else None,
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
            ocel_id=self.request.ocel_id,
            method_id=self.request.method_id,
            name=self.request.name,
            resource_type=self._actual_resource_type,
            output=self.result,
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
        filters = session.get_ocel_filters(request.ocel_id)
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
