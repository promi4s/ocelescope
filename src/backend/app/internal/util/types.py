from __future__ import annotations

import os
from typing import TypeAlias, TypeVar, Union

K = TypeVar("K")
V = TypeVar("V")
NestedDict: TypeAlias = dict[K, V | "NestedDict[K, V]"]
"""Type hint for nested dicts, containing values of type V at arbitrary depth, and keys of type K only."""


PathLike = Union[str, os.PathLike]
"""Type hint for file paths"""
