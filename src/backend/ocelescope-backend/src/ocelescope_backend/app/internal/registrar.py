from pathlib import Path

from ocelescope_backend.app.internal.config import config
from ocelescope_backend.app.internal.registry.registry_manager import registry_manager

prototyping_path = Path(__file__).parent / "prototype_plugins"


def register_initial_plugins():
    base = config.PLUGIN_DIR
    if not base:
        return

    plugin_ids = [
        module_dir.name for module_dir in base.iterdir() if module_dir.is_dir()
    ]

    registry_manager.load_plugins(plugin_ids)
