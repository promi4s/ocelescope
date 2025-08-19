#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import sys
import traceback
import zipfile
from pathlib import Path
from types import ModuleType

from ocelescope import OCELExtension, Plugin

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
DIST = ROOT / "dist"
DIST.mkdir(exist_ok=True)


def is_concrete_subclass(obj: object, base: type) -> bool:
    return (
        isinstance(obj, type)
        and issubclass(obj, base)
        and obj is not base
        and not getattr(obj, "__abstractmethods__", False)
    )


def load_package(pkg_dir: Path) -> ModuleType | None:
    """
    Load a package by executing its __init__.py with a synthetic module name
    and proper submodule search so relative imports inside the package work.
    """
    init_py = pkg_dir / "__init__.py"
    if not init_py.exists():
        return None

    module_name = f"plugin_{pkg_dir.name}"
    try:
        spec = importlib.util.spec_from_file_location(
            module_name,
            init_py,
            submodule_search_locations=[str(pkg_dir)],  # mark as a package
        )
        if spec is None or spec.loader is None:
            print(f"⚠️  Skipping {pkg_dir}: could not create import spec")
            return None

        module = importlib.util.module_from_spec(spec)
        # ensure intra-package relative imports work during exec
        sys.modules[module_name] = module
        spec.loader.exec_module(module)  # type: ignore[arg-type]
        return module
    except Exception:
        print(f"❌ Failed to import {pkg_dir} as {module_name}:\n{traceback.format_exc()}")
        sys.modules.pop(module_name, None)
        return None


def module_has_plugin(module: ModuleType) -> bool:
    """Return True if the loaded module defines at least one concrete Plugin subclass."""
    found = False
    for obj in vars(module).values():
        if is_concrete_subclass(obj, Plugin):
            print(f"✅ Found Plugin: {obj.__name__} (from {module.__name__})")
            found = True
    # Optional: show extensions discovered (not required to zip)
    for obj in vars(module).values():
        if is_concrete_subclass(obj, OCELExtension):
            print(f"ℹ️  Found Extension: {obj.__name__} (from {module.__name__})")
    return found


def zip_package(pkg_dir: Path) -> Path:
    """Create dist/<pkg>.zip including the package folder at the top level."""
    zip_path = DIST / f"{pkg_dir.name}.zip"
    base_for_archive = pkg_dir.parent  # include folder name inside zip
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in pkg_dir.rglob("*"):
            if path.is_file():
                zf.write(path, path.relative_to(base_for_archive))
    print(f"📦 Wrote {zip_path}")
    return zip_path


def main() -> int:
    if not SRC.exists():
        print(f"❌ Expected src directory at {SRC}")
        return 2

    zipped_any = False

    for pkg_dir in sorted(SRC.iterdir()):
        if not (pkg_dir.is_dir() and (pkg_dir / "__init__.py").exists()):
            continue
        if pkg_dir.name.startswith("_"):
            continue

        print(f"🔎 Checking {pkg_dir} ...")
        module = load_package(pkg_dir)
        if module and module_has_plugin(module):
            zip_package(pkg_dir)
            zipped_any = True
        else:
            print(f"⏭️  No valid Plugin found in {pkg_dir}; skipping zip.")

    if not zipped_any:
        print("❌ No loadable plugin packages found in src/.")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
