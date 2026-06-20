from typing import Self, cast

import pandas as pd
from pydantic import BaseModel


class RelationCountSummary(BaseModel):
    """
    Summary statistics for relationship multiplicities in O2O or E2O relations.

    Captures, for each combination of source type, target type and qualifier,
    how many related items occur per source instance.

    Attributes:
        qualifier: The relation qualifier (empty string when none applies).
        source: The source object or event type.
        target: The target object or event type.
        min_count: The minimum number of related items for any source instance.
        max_count: The maximum number of related items for any source instance.
        sum: The total number of relation occurrences across all instances.
    """

    qualifier: str
    source: str
    target: str
    min_count: int
    max_count: int
    sum: int

    @classmethod
    def from_summary(cls, summary: pd.DataFrame) -> list[Self]:
        """
        Convert a relation summary DataFrame (as returned by ``O2OManager.summary``
        or ``E2OManager.summary``) into a list of ``RelationCountSummary``.

        The summary is read positionally from its index: level 0 is the source
        type, level 1 the target type, and level 2 (if present) the qualifier.
        """
        has_qualifier = summary.index.nlevels >= 3

        summaries: list[Self] = []
        for index, row in summary.iterrows():
            key = cast(
                "tuple[str, ...]", index if isinstance(index, tuple) else (index,)
            )
            summaries.append(
                cls(
                    source=str(key[0]),
                    target=str(key[1]),
                    qualifier=str(key[2]) if has_qualifier else "",
                    min_count=cast(int, row["min"]),
                    max_count=cast(int, row["max"]),
                    sum=cast(int, row["sum"]),
                )
            )

        return summaries
