"""Register discovery methods shipped with the ocelescope SDK."""

from ocelescope.discovery import algorithms
from ocelescope_backend.app.internal.discovery.registry import (
    register_discovery_methods_from_module,
)


def register_builtin_discovery_methods() -> None:
    # The SDK's `algorithms` package re-exports each built-in @discovery_method
    # function; scanning the package module is enough to pick them all up.
    register_discovery_methods_from_module(algorithms)
