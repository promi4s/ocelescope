from __future__ import annotations

from threading import Lock

from cachetools import LRUCache


class BaseManager:
    """Base class for all manager classes providing per-instance caching."""

    def __init__(self):
        self.cache = LRUCache(maxsize=128)
        self.cache_lock = Lock()
