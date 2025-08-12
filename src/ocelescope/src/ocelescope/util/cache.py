import functools
import json
import operator
import uuid
import warnings
from contextlib import nullcontext
from typing import Callable, Hashable

from cachetools import cachedmethod
from cachetools.keys import methodkey


class CacheError(Exception):
    pass


EXCEPTION_ON_NON_HASHABLE = True
EXCEPTION_ON_TASK_ARG = True


def key_decorator_make_hashable(make_hashable: bool, func: Callable, ignore_first: bool = True):
    """Allows for hashing built-in collections (set, list, dict) as cache key arguments, depending on `make_hashable`."""

    def decorator(key):
        @functools.wraps(key)
        def key_wrapper(*args, **kwargs):
            if ignore_first:
                # cachetools.cachedmethod passes the instance as first argument for convenience. Not relevant as key.
                self, *args = args
            if make_hashable:
                args = (hash_cache_argument(arg) for arg in args)
                kwargs = {k: hash_cache_argument(v) for k, v in kwargs.items()}
            else:
                # Sanity check:
                # - any arg or kwarg value not hashable?
                if any(not isinstance(arg, Hashable) for arg in args) or any(
                    not isinstance(v, Hashable) for v in kwargs.values()
                ):
                    # key creation will shortly fail. Give a hint what function decorator to adjust.
                    unhashable_types = sorted(
                        set(type(arg).__name__ for arg in args if not isinstance(arg, Hashable))
                        | set(
                            type(v).__name__ for v in kwargs.values() if not isinstance(v, Hashable)
                        )
                    )
                    if any(isinstance(arg, (set, list, dict)) for arg in args) or any(
                        isinstance(v, (set, list, dict)) for v in kwargs.values()
                    ):
                        msg = f"{func.__name__}: Encountered non-hashable collection argument(s) of type(s) {', '.join(unhashable_types)}. You probably want to set make_hashable=True on the cache decorator."
                    else:
                        msg = f"{func.__name__}: Encountered non-hashable argument(s) of type(s) {', '.join(unhashable_types)}. Omitting for cache key computation."
                    if EXCEPTION_ON_NON_HASHABLE:
                        raise CacheError(msg)
                    else:
                        warnings.warn(msg)
                args = (arg if isinstance(arg, Hashable) else uuid.uuid4() for arg in args)
                kwargs = {
                    k: v if isinstance(v, Hashable) else uuid.uuid4() for k, v in kwargs.items()
                }
            return key(self, *args, **kwargs)  # type: ignore

        object.__setattr__(key_wrapper, "_make_hashable", make_hashable)
        return key_wrapper

    return decorator


def hash_cache_argument(x):
    """Hashes a function argument for cachetools key computation. Allows using set, list and dict as cacheable arguments."""

    if isinstance(x, Hashable):
        return hash(x)

    if isinstance(x, set):
        # Sort set elements by their hashes
        x = sorted(x, key=hash)

    if isinstance(x, (set, list, dict)):
        # Convert to JSON string with sorted keys
        return hash(json.dumps(x, sort_keys=True))

    raise TypeError(f"unhashable type: '{type(x)}'")


def key_decorator_add_func_name(func: Callable):
    """Adds the method name to cache key arguments. This allows using the same Cache object for multiple methods of the same instance."""

    def decorator(key):
        @functools.wraps(key)
        def key_wrapper(self, *args, **kwargs):
            return key(self, func.__name__, *args, **kwargs)

        return key_wrapper

    return decorator


def key_decorator_add_ocelwrapper_state_id():
    """Adds `stateId` of the first OcelWrapper argument to the cache key."""

    def decorator(key):
        def key_wrapper(self, *args, **kwargs):
            from ocel.ocel import OCEL

            value = ""
            for arg in args:
                if isinstance(arg, OCEL):
                    value = getattr(arg, "state_id", "")
                    break
            if not value:
                for v in kwargs.values():
                    if isinstance(v, OCEL):
                        value = getattr(v, "state_id", "")
                        break
            return key(self, value, *args, **kwargs)

        return key_wrapper

    return decorator


# from: https://cachetools.readthedocs.io/en/latest/#cachetools.cachedmethod
# "The key function will be called as key(self, *args, **kwargs) to retrieve a suitable cache key.
# Note that the default key function, cachetools.keys.methodkey(), ignores its first argument, i.e. self.
# This has mostly historical reasons, but also ensures that self does not have to be hashable."
#
# -> Now, every instance gets its own cache object, initialized in the constructor.
def instance_lru_cache(
    key: Callable | None = None,
    make_hashable: bool = False,
    use_lock: bool = True,
    include_ocel_state: bool = False,
):
    """Caches an instance method.

    Arguments:
    - key -- The cache key function, default `methodkey`. Gets passed (self, <method name>, *args, **kwargs), and should ignore the first argument.
    - make_hashable -- When True, enables hashing of set, list and dict arguments.
    """

    if key is None:
        key = methodkey

    def decorator(func):
        key1 = key_decorator_make_hashable(
            make_hashable=make_hashable, func=func, ignore_first=True
        )(key)
        key2 = key_decorator_add_func_name(func=func)(key1)
        _key = key2

        def lock_context(self):
            if use_lock:
                try:
                    return self.cache_lock
                except AttributeError:
                    raise CacheError(f"{func.__name__}: cache_lock is not defined.")
            return nullcontext()

        def cache_has(self, *args, **kwargs):
            """Checks if an item is contained in the method cache.

            Arguments:
                - self -- The instance
                - *args, **kwargs -- Arguments of a previous method call"""
            with lock_context(self):
                return _key(self, *args, **kwargs) in self.cache

        def cache_forget(self, *args, **kwargs):
            """Deletes an item from the method cache.

            Arguments:
                - self -- The instance
                - *args, **kwargs -- Arguments of a previous method call"""
            with lock_context(self):
                k = _key(self, *args, **kwargs)
                if k in self.cache:
                    del self.cache[k]

        def cache_clear(self):
            """Clears the method cache.

            Arguments:
                - self -- The instance"""
            with lock_context(self):
                ks = [k for k in self.cache.keys() if k[0] == func.__name__]
                for k in ks:
                    del self.cache[k]

        func_cached = cachedmethod(
            cache=operator.attrgetter("cache"),
            lock=operator.attrgetter("cache_lock") if use_lock else None,
            key=_key,
        )(func)
        # Assign method cache helpers
        # (func_cached.cache and existing convenience methods refer to the whole object cache)
        func_cached.cache_has = cache_has
        func_cached.cache_forget = cache_forget
        func_cached.cache_clear = (
            cache_clear  # Overriding the original method, only clearing cache for this method
        )
        return func_cached

    return decorator
