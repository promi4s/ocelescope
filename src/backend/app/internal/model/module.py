from threading import RLock
from typing import Any

from cachetools import LRUCache


class Module:
    def __init__(self, *, max_cache_size: int = 128):
        self.cache = LRUCache(maxsize=max_cache_size)
        self.cache_lock = RLock()

    def clear_cache(self):
        """Clear all cached method results."""
        with self.cache_lock:
            self.cache.clear()

    def clear_method_cache(self, method_name: str):
        """Clear cached results for a specific method."""
        with self.cache_lock:
            keys_to_remove = [
                k
                for k in self.cache.keys()
                if isinstance(k, tuple) and k[0] == method_name
            ]
            for k in keys_to_remove:
                del self.cache[k]

    def cache_keys(self) -> list[Any]:
        """Return a list of keys currently in the cache."""
        with self.cache_lock:
            return list(self.cache.keys())
