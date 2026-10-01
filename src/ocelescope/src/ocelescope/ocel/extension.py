from abc import ABC, abstractmethod
from typing import ClassVar, Self

from ocelescope.ocel.core import OCEL


class OCELExtension(ABC):
    """Compose an existing OCEL with domain-specific managers.

    Extensions define their own construction and optional validation. The supplied
    OCEL retains ownership of its connection and must outlive the extension.
    """

    id: ClassVar[str]
    label: ClassVar[str]

    @classmethod
    @abstractmethod
    def from_ocel(cls, ocel: OCEL) -> Self:
        """Build an extension over the supplied OCEL."""
        ...

    @classmethod
    def is_valid(cls, ocel: OCEL) -> bool:
        try:
            cls.from_ocel(ocel)
        except Exception:
            return False

        return True
