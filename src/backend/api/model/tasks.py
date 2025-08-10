from typing import Generic, Optional, TypeVar
from pydantic.main import BaseModel

from tasks.base import TaskState


T = TypeVar("T")


class TaskSummary(BaseModel):
    key: str
    state: TaskState


class TaskResponse(BaseModel, Generic[T]):
    status: TaskState
    taskId: Optional[str] = None
    result: Optional[T] = None
    error: Optional[str] = None
