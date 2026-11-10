from __future__ import annotations

from typing import Literal

Mode = Literal["include", "exclude"]


def between(value: str, low: str | None, high: str | None) -> str:
    bounds = [
        f"{value} {comparison} {bound}"
        for bound, comparison in ((low, ">="), (high, "<="))
        if bound is not None
    ]
    return " AND ".join(bounds) or "true"
