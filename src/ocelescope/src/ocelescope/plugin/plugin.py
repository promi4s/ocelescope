import inspect
from abc import ABC
from types import MethodType
from typing import (
    ClassVar,
    Optional,
)

from pydantic import BaseModel

from ocelescope.plugin.decorators import PluginMethod
from ocelescope.resource.resource import Resource


class PluginMeta(BaseModel):
    name: str
    version: str
    label: str
    description: Optional[str]


class Plugin(ABC):
    version: ClassVar[str]
    label: ClassVar[str]
    description: ClassVar[Optional[str]] = None

    @classmethod
    def get_name(cls):
        return cls.__name__

    @classmethod
    def method_map(cls) -> dict[str, PluginMethod]:
        method_map: dict[str, PluginMethod] = {}
        for _, method in inspect.getmembers(cls, predicate=inspect.isfunction):
            method_meta = getattr(method, "__meta__", None)

            if not isinstance(method_meta, PluginMethod):
                continue

            method_map[method_meta.name] = method_meta

        return method_map

    @classmethod
    def get_resources(cls) -> list[type[Resource]]:
        return list(
            dict.fromkeys(
                resource_type
                for method_meta in cls.method_map().values()
                for io_element in [*method_meta.inputs, *method_meta.outputs]
                for resource_type in io_element.resource_types
            )
        )
