from __future__ import annotations

import os
import shutil
from collections.abc import Callable
from contextlib import ExitStack
from dataclasses import dataclass
from itertools import count
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


def map_inputs(value: Any, fn: Callable[[Any], Any]) -> Any:
    if isinstance(value, dict):
        return {key: map_inputs(item, fn) for key, item in value.items()}
    if isinstance(value, list):
        return [map_inputs(item, fn) for item in value]
    if isinstance(value, tuple):
        return tuple(map_inputs(item, fn) for item in value)
    return fn(value)


def copy_files(value: Any, task_dir: Path) -> Any:
    index = count()

    def copy(item: Any) -> Any:
        if not isinstance(item, Path) or not item.is_file():
            return item
        target = task_dir / f"input_{next(index)}_{item.name}"
        try:
            os.link(item, target)
        except OSError:
            shutil.copy2(item, target)
        return target

    return map_inputs(value, copy)


def open_inputs(value: Any, stack: ExitStack) -> Any:
    def open_input(item: Any) -> Any:
        if isinstance(item, OcelInput | ResourceInput):
            return stack.enter_context(item.open())
        return item

    return map_inputs(value, open_input)


def find_open_entities(value: Any) -> list[str]:
    if isinstance(value, OCEL | ResourceBase):
        return [type(value).__name__]
    if isinstance(value, dict):
        value = list(value.values())
    if isinstance(value, list | tuple):
        return [name for item in value for name in find_open_entities(item)]
    return []
