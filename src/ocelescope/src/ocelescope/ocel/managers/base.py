from __future__ import annotations

from threading import Lock
from typing import TYPE_CHECKING

from cachetools import LRUCache

if TYPE_CHECKING:
    from ocelescope.ocel.core.ocel import OCEL


class BaseManager:
    """Base class for all manager classes providing per-instance caching."""

    def __init__(self, ocel: "OCEL"):
        self._ocel = ocel
        self.cache = LRUCache(maxsize=128)
        self.cache_lock = Lock()
