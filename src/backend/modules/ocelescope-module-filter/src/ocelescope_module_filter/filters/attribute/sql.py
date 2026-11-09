from __future__ import annotations

from typing import Literal

from ocelescope.ocel.view.step import Step
from ocelescope.util.sql import literal

Mode = Literal["include", "exclude"]


def absent(value: str) -> str:
    return f"({value} IS NULL OR {value}::VARCHAR = '')"


def between(value: str, low: str | None, high: str | None) -> str:
    bounds = [
        f"{value} {comparison} {bound}"
        for bound, comparison in ((low, ">="), (high, "<="))
        if bound is not None
    ]
    return " AND ".join(bounds) or "true"


def in_list(column: str, names: list[str]) -> str:
    if not names:
        return "false"
    return f"{column} IN ({', '.join(literal(name) for name in names)})"


def attribute_names(step: Step, table: str) -> set[str]:
    columns = step.sql(f"SELECT * FROM {step[table]} LIMIT 0").columns
    return {column for column in columns if not column.startswith("ocel:")}
