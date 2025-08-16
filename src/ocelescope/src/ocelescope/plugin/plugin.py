from abc import ABC
import inspect
from typing import (
    ClassVar,
    Optional,
)

from pydantic import BaseModel


from ocelescope.plugin.decorators import PluginMethod


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
    def meta(cls):
        return PluginMeta(
            name=cls.__name__, version=cls.version, description=cls.description, label=cls.label
        )

    @classmethod
    def method_map(cls) -> dict[str, PluginMethod]:
        method_map: dict[str, PluginMethod] = {}
        for _, method in inspect.getmembers(cls, predicate=inspect.isfunction):
            method_meta = getattr(method, "__meta__", None)

            if not isinstance(method_meta, PluginMethod):
                continue

            method_map[method_meta.name] = method_meta

        return method_map
