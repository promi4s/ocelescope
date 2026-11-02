import shutil
import tempfile
import traceback
import zipfile
from pathlib import Path, PurePosixPath
from uuid import uuid4

from ocelescope_backend.app.internal.config import config as backend_config
from ocelescope_backend.app.internal.util.archive import extract_archive, is_ignored
from ocelescope_backend.app.sse_manager import (
    ErrorNotification,
    InvalidationRequest,
    SSEMessage,
    SystemNotification,
)

from ocelescope_module_plugin.config import config
from ocelescope_module_plugin.registry import PluginRegistry


def is_plugin_archive(archive: zipfile.ZipFile) -> bool:
    return any(
        len(path.parts) == 2 and path.name == "__init__.py" and not is_ignored(path)
        for path in map(PurePosixPath, archive.namelist())
    )


def import_plugin_archive(
    registry: PluginRegistry, archive: zipfile.ZipFile, file_name: str
) -> list[SSEMessage]:
    if not config.PLUGIN_DIR:
        raise RuntimeError("Plugin uploads are disabled on this deployment")

    added_plugin_ids = []

    with tempfile.TemporaryDirectory() as temp_dir:
        extract_archive(
            archive,
            Path(temp_dir),
            max_uncompressed_bytes=backend_config.ARCHIVE_MAX_UNCOMPRESSED_BYTES,
        )

        for plugin_candidate in Path(temp_dir).iterdir():
            if (
                plugin_candidate.is_dir()
                and (plugin_candidate / "__init__.py").exists()
            ):
                plugin_id = f"plugin_{uuid4()!s}"
                shutil.move(plugin_candidate, config.PLUGIN_DIR / plugin_id)
                added_plugin_ids.append(plugin_id)

    results: list[SSEMessage] = []
    loaded_plugin_ids: list[str] = []
    for plugin_id in added_plugin_ids:
        try:
            loaded_plugin_ids.extend(
                registry.load_from_dir(
                    config.PLUGIN_DIR, [plugin_id], ignore_errors=False
                )
            )
        except Exception as exc:
            results.append(
                ErrorNotification(
                    type="error",
                    title=f"Error while uploading plugin {file_name}",
                    message=str(exc),
                    trace=traceback.format_exc(),
                )
            )

    loaded_plugins = [
        plugin.label
        for id in loaded_plugin_ids
        if (plugin := registry.get_plugin(id)) is not None
    ]

    if len(loaded_plugins) == 0:
        if not results:
            results.append(
                SystemNotification(
                    type="notification",
                    title="Uploaded zip didn't contain any plugins",
                    notification_type="error",
                    message=f"The uploaded file {file_name} did not contain any valid plugins",
                )
            )
        return results

    results.extend(
        [
            SystemNotification(
                title="Plugin successfully uploaded",
                message=f"Successfully uploaded {' '.join(loaded_plugins)}",
                notification_type="info",
            ),
            InvalidationRequest(routes=["plugins", "tasks", "discoveryMethods"]),
        ]
    )
    return results
