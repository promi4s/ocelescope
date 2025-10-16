from __future__ import annotations

import ast
import importlib.util
import sys
import traceback
import zipfile
from pathlib import Path
from types import ModuleType

from ocelescope import OCELExtension, Plugin

ROOT = Path.cwd()
SRC = ROOT / "src"
DIST = ROOT / "dist"
DIST.mkdir(exist_ok=True)


def find_absolute_imports(package_dir: Path):
    package_name = package_dir.name
    absolute_imports = []

    for py_file in package_dir.rglob("*.py"):
        try:
            tree = ast.parse(py_file.read_text())
        except SyntaxError:
            print(f"⚠️ Skipping {py_file} (could not parse)")
            continue

        for node in ast.walk(tree):
            match node:
                # Case 1: import mypkg...
                case ast.Import(names=names) if any(
                    alias.name == package_name or alias.name.startswith(package_name + ".")
                    for alias in names
                ):
                    absolute_imports.append(
                        {
                            "file": py_file,
                            "lineno": node.lineno,
                            "statement": ast.unparse(node),
                        }
                    )

                # Case 2: from mypkg... import ...
                case ast.ImportFrom(module=mod) if mod and mod.startswith(package_name):
                    absolute_imports.append(
                        {
                            "file": py_file,
                            "lineno": node.lineno,
                            "statement": ast.unparse(node),
                        }
                    )

    return absolute_imports


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


def module_has_plugin(module: ModuleType) -> str | None:
    """Return True if the loaded module defines at least one concrete Plugin subclass."""
    for obj in vars(module).values():
        if is_concrete_subclass(obj, Plugin):
            print(f"✅ Found Plugin: {obj.__name__} (from {module.__name__})")
            return obj.__name__
    # Optional: show extensions discovered (not required to zip)
    for obj in vars(module).values():
        if is_concrete_subclass(obj, OCELExtension):
            print(f"ℹ️  Found Extension: {obj.__name__} (from {module.__name__})")


def zip_package(pkg_dir: Path, name: str | None) -> Path:
    """Create dist/<pkg>.zip including the package folder at the top level."""
    zip_path = DIST / f"{name or pkg_dir.name}.zip"
    base_for_archive = pkg_dir.parent  # include folder name inside zip
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in pkg_dir.rglob("*"):
            if path.is_file():
                zf.write(path, path.relative_to(base_for_archive))
    print(f"📦 Wrote {zip_path}")
    return zip_path


def build_plugins() -> int:
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

        # 🚨 check for absolute imports
        abs_imports = find_absolute_imports(pkg_dir)
        if abs_imports:
            print(f"❌ Skipping {pkg_dir}: found absolute imports:")
            for imp in abs_imports:
                print(f"   {imp['file']}:{imp['lineno']} -> {imp['statement']}")
            continue

        module = load_package(pkg_dir)

        if module and (plugin_name := module_has_plugin(module)):
            zip_package(pkg_dir, plugin_name)
            zipped_any = True
        else:
            print(f"⏭️  No valid Plugin found in {pkg_dir}; skipping zip.")

    if not zipped_any:
        print("❌ No loadable plugin packages found in src/.")
        return 1

    return 0
