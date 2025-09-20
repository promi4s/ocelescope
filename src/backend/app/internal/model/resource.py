from typing import Any, TypedDict
from pydantic import BaseModel
from datetime import datetime

from pydantic.fields import Field


class PluginSource(TypedDict):
    task_id: str
    plugin_name: str
    method_name: str
    version: str


class ResourceBase(BaseModel):
    type: str
    created_at: str = Field(default_factory=lambda: str(datetime.now()))
    name: str
    source: PluginSource | None


class ResourceStore(ResourceBase):
    data: dict[str, Any]


class ResourceApi(ResourceBase):
    id: str
