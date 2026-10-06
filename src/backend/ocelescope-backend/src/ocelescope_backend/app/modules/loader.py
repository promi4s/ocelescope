from functools import cache
from importlib.metadata import entry_points
from typing import Any

from fastapi import FastAPI

from ocelescope import OCEL
from ocelescope_backend.app.internal.docs import init_custom_docs
from ocelescope_backend.app.internal.logger import get_logger, logger
from ocelescope_backend.app.internal.registry import registry_manager
from ocelescope_backend.app.modules.base import Module
from ocelescope_backend.app.modules.context import ModuleContext, ModuleRegistry

ENTRYPOINT_GROUP = "ocelescope_backend.modules"


def get_module_path(module: type[Module]):
    return f"/modules/{module.meta.key}/v{module.meta.version.major}"


def get_module_source_id(module: type[Module]):
    return f"module:{module.meta.key}:v{module.meta.version.major}"


def build_module(module_cls: type[Module]) -> Module:
    source_id = get_module_source_id(module_cls)
    return module_cls(
        ModuleContext(
            logger=get_logger(f"modules.{module_cls.meta.key}"),
            registry=ModuleRegistry(registry_manager.resource_registry, source_id),
            source_id=source_id,
            mount_path=get_module_path(module_cls),
        )
    )


def discover_modules() -> list[type[Module]]:
    modules: list[type[Module]] = []

    for ep in entry_points(group=ENTRYPOINT_GROUP):
        loaded: Any = ep.load()

        if not issubclass(loaded, Module):
            logger.warning(
                f"Entry point '{ep.name}' from '{ep.module}' is not a subclass of Module"
            )
            continue

        modules.append(loaded)

    return modules


@cache
def known_extensions() -> list[type[OCEL]]:
    """The OCEL extensions the installed modules know, one per name.

    Read off the modules' ``extensions`` through their entry points.
    """
    by_name: dict[str, type[OCEL]] = {}
    for module_cls in discover_modules():
        for ocel_type in module_cls.extensions:
            if ocel_type.extension is not None:
                by_name.setdefault(ocel_type.extension.name, ocel_type)
    return list(by_name.values())


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

        module = build_module(module_cls)
        module.registry.load(module_cls.resources)

        sub_app = module.create_app()

        module_path = get_module_path(module_cls)

        if sub_app.docs_url is None and sub_app.redoc_url is None:
            init_custom_docs(sub_app)

        app.mount(module_path, sub_app)
        logger.info(f"Mounted module {meta.key} v{meta.version} at {module_path}")

        seen_modules.add((meta.key, meta.version.major))

    return discovered
