import importlib
import importlib.util
import os
from pathlib import Path
import pkgutil
import sys

from fastapi import FastAPI
from fastapi.routing import APIRoute, APIRouter

from api.config import config
from registry.plugin import plugin_registry
from registry.extension import extension_registry


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
    if not base.exists():
        return

    for module_dir in base.iterdir():
        if not module_dir.is_dir():
            continue

        module_name = module_dir.name  # same as during upload (uuid hex)

        # Find the first direct child that is a package (contains __init__.py)
        pkg_dir = None
        for child in module_dir.iterdir():
            if child.is_dir() and (child / "__init__.py").exists():
                pkg_dir = child
                break

        if not pkg_dir:
            # nothing to load; skip this folder
            continue

        try:
            plugin_module_path = pkg_dir / "__init__.py"
            spec = importlib.util.spec_from_file_location(
                module_name, plugin_module_path
            )
            if not spec or not spec.loader:
                print(f"[PLUGIN] No loader for {plugin_module_path}")
                continue

            module = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = module
            spec.loader.exec_module(module)

            plugin_registry.register(module)  # ensure spelling: plugin_registry
            extension_registry.register(module)

            print(f"[PLUGIN] Loaded {module_name} from {plugin_module_path}")
        except Exception as e:
            print(f"[PLUGIN] Failed to load {module_name}: {e}")
