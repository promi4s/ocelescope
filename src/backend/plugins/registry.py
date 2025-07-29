import functools
from typing import Callable, Optional
from .base import BasePlugin


def plugin_method(
    label: Optional[str], description: str = "", tags: Optional[list[str]] = None
):
    def decorator(func: Callable):
        @functools.wraps(func)
        def wrapped(*args, **kwargs):
            kwargs.pop("session", None)
            kwargs.pop("stop_event", None)

            return func(*args, **kwargs)

        setattr(
            wrapped,
            "_plugin_method_metadata",
            {"label": label, "description": description, "tags": tags or []},
        )

        return wrapped

    return decorator


class PluginRegistry:
    def __init__(self) -> None:
        self._registry: dict[tuple[str, str], type[BasePlugin]] = {}

    def register(self, label: Optional[str], version: str, description: str):
        def decorator(cls: type[BasePlugin]):
            name = cls.__name__
            key = (name, version)
            if key in self._registry:
                raise ValueError(f"Plugin '{name}' v'{version}' already registered")

            setattr(
                cls,
                "_plugin_metadata",
                {
                    "name": name,
                    "label": label or name,
                    "version": version,
                    "description": description,
                },
            )

            self._registry[key] = cls
            return cls

        return decorator

    def get_plugin(self, name: str, version: str) -> type[BasePlugin]:
        return self._registry[(name, version)]

    def all_plugins(self) -> dict[tuple[str, str], type[BasePlugin]]:
        return self._registry

    def pop_plugins(self, name: str, version: Optional[str]):
        return [
            self._registry.pop((plugin_name, plugin_version))
            for plugin_name, plugin_version in self._registry.keys()
            if name == plugin_name and (version is None or plugin_version == version)
        ]
