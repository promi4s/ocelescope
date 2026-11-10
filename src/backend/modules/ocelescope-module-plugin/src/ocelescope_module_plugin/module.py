import zipfile
from pathlib import Path

from fastapi import FastAPI
from ocelescope_backend.app.internal.config import config as backend_config
from ocelescope_backend.app.internal.util.archive import validate_archive
from ocelescope_backend.app.modules import Module, ModuleMeta
from ocelescope_backend.app.modules.context import ModuleContext
from ocelescope_backend.app.sse_manager import SSEMessage
from packaging.version import Version

from ocelescope_module_plugin.archive import import_plugin_archive, is_plugin_archive
from ocelescope_module_plugin.base_plugin import BasePlugin
from ocelescope_module_plugin.config import config
from ocelescope_module_plugin.registry import PluginRegistry
from ocelescope_module_plugin.routers import router


class PluginModule(Module):
    meta = ModuleMeta(key="plugin", version=Version("1.0"))

    def __init__(self, context: ModuleContext) -> None:
        super().__init__(context)
        self.plugins = PluginRegistry(self.registry)
        self.plugins.add_plugin(PluginRegistry.BASE_PLUGIN_ID, BasePlugin)

        if config.PLUGIN_DIR:
            self.plugins.load_from_dir(
                config.PLUGIN_DIR,
                [path.name for path in config.PLUGIN_DIR.iterdir() if path.is_dir()],
            )

    def create_app(self) -> FastAPI:
        app = FastAPI(
            title="Plugin",
            version=str(self.meta.version),
            docs_url=None,
            redoc_url=None,
        )
        app.state.plugin_registry = self.plugins

        app.include_router(router)

        return app

    def claim_upload(self, file_path: Path, file_name: str) -> list[SSEMessage] | None:
        if not zipfile.is_zipfile(file_path):
            return None

        with zipfile.ZipFile(file_path) as archive:
            if not is_plugin_archive(archive):
                return None

            validate_archive(
                archive,
                max_files=backend_config.ARCHIVE_MAX_FILES,
                max_uncompressed_bytes=backend_config.ARCHIVE_MAX_UNCOMPRESSED_BYTES,
            )
            return import_plugin_archive(self.plugins, archive, file_name)
