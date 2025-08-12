from abc import ABC, abstractmethod
from pathlib import Path
from typing import TypeVar

from ocelescope.ocel.constants import OCELFileExtensions


T = TypeVar("T", bound="OCELExtension")


class OCELExtension(ABC):
    """
    Abstract base class for OCEL extensions that can be imported/exported from a file path.
    """

    name: str
    description: str
    version: str
    supported_extensions: list[OCELFileExtensions]

    @staticmethod
    @abstractmethod
    def has_extension(path: Path) -> bool:
        """
        Check if the extension data exists at the given path.
        """
        pass

    @classmethod
    @abstractmethod
    def import_extension(cls: type[T], path: Path) -> T:
        """
        Create the extension by reading from the given path.
        """
        pass

    @abstractmethod
    def export_extension(self, path: Path) -> None:
        """
        Write the extension data to the given path.
        """
        pass
