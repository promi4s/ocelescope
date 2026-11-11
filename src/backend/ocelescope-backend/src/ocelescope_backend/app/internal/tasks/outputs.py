from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import TypeAlias
from uuid import uuid4

from ocelescope import OCEL, ResourceBase


def _new_id() -> str:
    return str(uuid4())


@dataclass
class Output:
    value: OCEL | ResourceBase | tuple[Path, str]
    name: str | None = None
    id: str = field(default_factory=_new_id)


TaskResult: TypeAlias = Output | list[Output] | tuple[Output, ...] | None
