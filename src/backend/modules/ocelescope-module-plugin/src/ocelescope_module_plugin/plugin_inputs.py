from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from ocelescope.plugin.decorators import PluginIO

from ocelescope import ResourceBase


@dataclass(frozen=True)
class ResourceArg:
    path: Path
    schema_hash: str


def match_resource_class(io: PluginIO, schema_hash: str) -> type[ResourceBase] | None:
    return next(
        (t for t in io.resource_types if t.get_schema_hash() == schema_hash), None
    )
