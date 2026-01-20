from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, Dict, TypeVar

from ocelescope.ocel.extensions.base_extension import OCELExtension

if TYPE_CHECKING:
    from ocelescope.ocel.core.ocel import OCEL


T = TypeVar("T", bound=OCELExtension)


class ExtensionManager:
    """Manage loading, storing, and exporting OCEL file extensions.

    The ExtensionManager is responsible for:
    - Detecting which extensions exist for a given OCEL file
    - Loading those extensions via their import interfaces
    - Providing access to loaded extensions
    - Exporting all extension data during OCEL write operations

    Attributes:
        ocel: The OCEL instance this manager belongs to.
        _extensions: A mapping of extension classes to extension instances.
    """

    def __init__(self, ocel: "OCEL"):
        self.ocel = ocel
        self._extensions: Dict[type[OCELExtension], OCELExtension] = {}

    def load(self, extensions: list[type[OCELExtension]]):
        """Attempt to load the given extension classes from the OCEL file.

        For each extension class, this method:
        - Checks whether the file format is supported
        - Detects whether the extension is present in the file
        - Imports the extension if available
        - Stores the loaded extension instance

        Args:
            extensions: A list of OCELExtension subclasses to check for and load.
        """

        if not self.ocel.meta.path:
            return

        path = Path(self.ocel.meta.path)

        for ext_cls in extensions:
            try:
                if path.suffix in getattr(ext_cls, "supported_extensions", []):
                    if ext_cls.has_extension(path):
                        instance = ext_cls.import_extension(self.ocel, path)
                        self._extensions[ext_cls] = instance
            except Exception as exc:
                print(f"[ExtensionManager] Failed to load {ext_cls.__name__}: {exc}")

    def get(self, ext_type: type[T]) -> T | None:
        """Retrieve a loaded extension instance by its class.

        Args:
            ext_type: The extension class to retrieve.

        Returns:
            The loaded extension instance, or None if it has not been loaded.
        """
        return self._extensions.get(ext_type)  # type: ignore

    def all(self) -> list[OCELExtension]:
        """Return all loaded extensions.

        Returns:
            A list of all extension instances currently managed.
        """
        return list(self._extensions.values())

    def export_all(self, target_path: Path):
        """Export all loaded extensions to disk.

        Only extensions that support the target file's extension are exported.
        Each extension defines how it writes its own data.

        Args:
            target_path: The destination path for the main OCEL file write.
        """
        for ext in self._extensions.values():
            try:
                if target_path.suffix in getattr(ext, "supported_extensions", []):
                    ext.export_extension(target_path)
            except Exception as exc:
                print(f"[ExtensionManager] Failed to export {type(ext).__name__}: {exc}")
