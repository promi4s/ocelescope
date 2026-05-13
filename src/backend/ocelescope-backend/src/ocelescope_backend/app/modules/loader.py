from importlib.metadata import entry_points
from typing import Any

from fastapi import FastAPI

from ocelescope_backend.modules.base import Module

ENTRYPOINT_GROUP = "ocelescope_backend.modules"


def discover_modules() -> list[type[Module]]:
    modules: list[type[Module]] = []

    for ep in entry_points(group=ENTRYPOINT_GROUP):
        loaded: Any = ep.load()

        if not isinstance(loaded, type):
            raise TypeError(
                f"Entry point '{ep.name}' did not load a class: {type(loaded)!r}"
            )

        if not issubclass(loaded, Module):
            raise TypeError(f"Entry point '{ep.name}' is not a subclass of Module")

        modules.append(loaded)

    return modules


def mount_modules(app: FastAPI) -> list[type[Module]]:
    discovered = discover_modules()

    seen_keys: set[str] = set()
    seen_paths: set[str] = set()

    for module_cls in discovered:
        meta = module_cls.meta

        if not meta.mount_path.startswith("/"):
            raise ValueError(
                f"Module '{meta.key}' has invalid mount_path: {meta.mount_path!r}"
            )

        if meta.key in seen_keys:
            raise ValueError(f"Duplicate module key detected: {meta.key}")

        if meta.mount_path in seen_paths:
            raise ValueError(f"Duplicate module mount_path detected: {meta.mount_path}")

        sub_app = module_cls.create_app()

        app.mount(meta.mount_path, sub_app)

        seen_keys.add(meta.key)
        seen_paths.add(meta.mount_path)

    return discovered
