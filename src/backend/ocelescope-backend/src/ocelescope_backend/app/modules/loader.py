from importlib.metadata import entry_points
from typing import Any

from fastapi import FastAPI

from ocelescope_backend.app.internal.docs import init_custom_docs
from ocelescope_backend.app.modules.base import Module

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

    seen_modules: set[tuple[str, int]] = set()

    for module_cls in discovered:
        meta = module_cls.meta

        if (meta.key, meta.version.major) in seen_modules:
            raise ValueError(
                f"Duplicated Module detected key: {meta.key} version: v{meta.version.major}"
            )

        sub_app = module_cls.create_app()

        sub_app_path = f"/modules/{meta.key}/v{meta.version.major}"

        if sub_app.docs_url is None and sub_app.redoc_url is None:
            sub_app.openapi_url = sub_app_path + "/openapi.json"
            init_custom_docs(sub_app)

        app.mount(f"/modules/{meta.key}/v{meta.version.major}", sub_app)

        seen_modules.add((meta.key, meta.version.major))

    return discovered
