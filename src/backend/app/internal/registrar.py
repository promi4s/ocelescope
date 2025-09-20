import importlib
import os
from pathlib import Path
import pkgutil

from fastapi import FastAPI
from fastapi.routing import APIRoute, APIRouter

from api.config import config
from registry import registry_manager


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
    base = config.PLUGIN_DIR
    if not base:
        return

    plugin_ids = [
        module_dir.name for module_dir in base.iterdir() if module_dir.is_dir()
    ]

    registry_manager.load_plugins(plugin_ids)
