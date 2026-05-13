import importlib
import importlib.util
import os
import sys
import tempfile
import zipfile
from pathlib import Path

from packaging import tags
from packaging.utils import parse_wheel_filename


# TODO: Use packiging to make this more normed
def import_wheel_dynamically(wheel_path: Path):
    """
    Dynamically loads a wheel (.whl) file if not already installed or imported.
    Returns the loaded package module.
    """
    with zipfile.ZipFile(wheel_path, "r") as whl:
        names = whl.namelist()
        pkg_names = [n.split("/")[0] for n in names if n.endswith("__init__.py")]
        if not pkg_names:
            raise ImportError("No package found in wheel")
        package_name = pkg_names[0]

    if package_name in sys.modules:
        return sys.modules[package_name]

    if importlib.util.find_spec(package_name) is not None:
        return importlib.import_module(package_name)

    temp_dir = Path(tempfile.mkdtemp(prefix="dynwhl_"))
    with zipfile.ZipFile(wheel_path, "r") as whl:
        whl.extractall(temp_dir)

    pkg_root = None
    for root, _, files in os.walk(temp_dir):
        if "__init__.py" in files:
            pkg_root = Path(root)
            break

    if not pkg_root:
        raise ImportError("No package with __init__.py found in wheel")

    sys.path.insert(0, str(pkg_root.parent))

    pkg = importlib.import_module(package_name)
    return pkg


def is_wheel_compatible(wheel_name: str):
    _, _, _, wheel_tags = parse_wheel_filename(wheel_name)

    supported_tag = set(tags.sys_tags())

    return bool(supported_tag & wheel_tags)
