from __future__ import annotations

from contextlib import ExitStack
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from ocelescope.ocel.view import OCELView

from ocelescope import OCEL, ResourceBase


@dataclass(frozen=True)
class OcelInput:
    path: Path
    kind: Literal["duckdb", "view"]

    def open(self) -> OCEL:
        if self.kind == "view":
            return OCELView.load(self.path)
        return OCEL.read_duckdb(self.path, read_only=True)


@dataclass(frozen=True)
class ResourceInput:
    path: Path
    resource_class: type[ResourceBase]

    def open(self) -> ResourceBase:
        return self.resource_class.open(self.path)


def open_inputs(value: Any, stack: ExitStack) -> Any:
    if isinstance(value, OcelInput | ResourceInput):
        return stack.enter_context(value.open())
    if isinstance(value, dict):
        return {key: open_inputs(item, stack) for key, item in value.items()}
    if isinstance(value, list):
        return [open_inputs(item, stack) for item in value]
    if isinstance(value, tuple):
        return tuple(open_inputs(item, stack) for item in value)
    return value


def find_open_entities(value: Any) -> list[str]:
    if isinstance(value, OCEL | ResourceBase):
        return [type(value).__name__]
    if isinstance(value, dict):
        value = list(value.values())
    if isinstance(value, list | tuple):
        return [name for item in value for name in find_open_entities(item)]
    return []
