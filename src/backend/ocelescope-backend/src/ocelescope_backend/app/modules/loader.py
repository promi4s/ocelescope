from importlib.metadata import entry_points
from typing import Any

from fastapi import FastAPI

from ocelescope_backend.app.internal.docs import init_custom_docs
from ocelescope_backend.app.internal.logger import logger
from ocelescope_backend.app.modules.base import Module

ENTRYPOINT_GROUP = "ocelescope_backend.modules"


def get_module_path(module: type[Module]):
    return f"/modules/{module.meta.key}/v{module.meta.version.major}"


def discover_modules() -> list[type[Module]]:
    modules: list[type[Module]] = []

    for ep in entry_points(group=ENTRYPOINT_GROUP):
        loaded: Any = ep.load()

        if not issubclass(loaded, Module):
            logger.warning(f"Entry point '{ep.name}' is not a subclass of Module")
            continue

        modules.append(loaded)

    return modules


def mount_modules(app: FastAPI) -> list[type[Module]]:
    discovered = discover_modules()

    seen_modules: set[tuple[str, int]] = set()

    for module_cls in discovered:
        meta = module_cls.meta

        if (meta.key, meta.version.major) in seen_modules:
            logger.warning(
                f"Duplicated Module detected key: {meta.key} version: v{meta.version.major}"
            )
            continue

        sub_app = module_cls.create_app()

        module_path = get_module_path(module_cls)

        if sub_app.docs_url is None and sub_app.redoc_url is None:
            sub_app.openapi_url = module_path + "/openapi.json"
            init_custom_docs(sub_app)

        app.mount(module_path, sub_app)

        seen_modules.add((meta.key, meta.version.major))

    return discovered
