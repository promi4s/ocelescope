import importlib
import importlib.util
import os
from pathlib import Path
import pkgutil
import sys

from fastapi import FastAPI
from fastapi.routing import APIRoute, APIRouter

from api.config import config
from registry import plugin_registy, extension_registry


# Use direct path-based loading for safety
modules_path = [os.path.join(os.path.dirname(__file__), "modules")]
prototyping_path = Path(__file__).parent / "prototype_plugins"


def register_modules(app: FastAPI):
    for _, module_name, _ in pkgutil.iter_modules(modules_path):
        try:
            mod = importlib.import_module(f"modules.{module_name}.module")
        except ModuleNotFoundError as e:
            print(f"Module '{module_name}' skipped: {e}")
            continue
        except Exception as e:
            print(f"Failed to load module '{module_name}': {e}")
            continue

        if hasattr(mod, "router"):
            router: APIRouter = mod.router

            for route in router.routes:
                if isinstance(route, APIRoute):
                    route.operation_id = (
                        f"{module_name}_{route.operation_id or route.name}"
                    )

            meta = getattr(mod, "meta", {})
            prefix = meta.get("prefix", f"/{module_name}")
            tags = meta.get("tags", [module_name])
            app.include_router(mod.router, prefix=prefix, tags=tags)

        if hasattr(mod, "State"):
            setattr(mod, "_module_state", mod.State)

        if hasattr(mod, "meta"):
            setattr(mod, "_module_meta", mod.meta)


def register_initial_plugins():
    folders = [config.PLUGIN_DIR] + (
        [prototyping_path] if config.MODE == "development" else []
    )

    for folder in folders:
        for item in folder.iterdir():
            if item.is_dir() and (item / "__init__.py").exists():
                plugin_module_path = item / "__init__.py"
                module_name = f"plugin_{item.name}"
                spec = importlib.util.spec_from_file_location(
                    module_name, plugin_module_path
                )
                if spec and spec.loader:
                    module = importlib.util.module_from_spec(spec)
                    sys.modules[module_name] = module
                    spec.loader.exec_module(module)
                    plugin_registy.register(module)
                    extension_registry.register(module)
