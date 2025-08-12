import inspect
from typing import (
    Optional,
)


from ocelescope.plugin.decorators import PluginMeta, PluginMethod


# region PluginBase


class Plugin:
    @classmethod
    def meta(cls):
        meta: Optional[PluginMeta] = getattr(cls, "__meta__", None)

        if meta is None:
            return PluginMeta(name=cls.__name__, version="1.0", description="", label=cls.__name__)

        return meta

    @classmethod
    def method_map(cls) -> dict[str, PluginMethod]:
        method_map: dict[str, PluginMethod] = {}
        for _, method in inspect.getmembers(cls, predicate=inspect.isfunction):
            method_meta = getattr(method, "__meta__", None)

            if not isinstance(method_meta, PluginMethod):
                continue

            method_map[method_meta.name] = method_meta

        return method_map


# endregion
