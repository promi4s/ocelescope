from typing import Self, cast

import pandas as pd
from pydantic import BaseModel


class RelationCombination(BaseModel):
    """A distinct (source, target, qualifier) combination of a relation.

    Attributes:
        source: The source object or event type.
        target: The target object or event type.
        qualifier: The relation qualifier (empty string when none applies).
    """

    source: str
    target: str
    qualifier: str

    @classmethod
    def from_combinations(cls, combinations: pd.DataFrame) -> list[Self]:
        """Convert a qualifier-aware combination table (as returned by
        ``E2OManager.combinations``/``O2OManager.combinations`` with
        ``with_qualifier=True``) into a list of ``RelationCombination``.

        Columns are read positionally: 0 = source, 1 = target, 2 = qualifier.
        """
        return [
            cls(
                source=str(row.iloc[0]),
                target=str(row.iloc[1]),
                qualifier=str(row.iloc[2]),
            )
            for _, row in combinations.iterrows()
        ]


class RelationCountSummary(BaseModel):
    """
    Summary statistics for relationship multiplicities in O2O or E2O relations.

    Captures, for each combination of source type, target type and qualifier,
    how many related items occur per source instance.

    Attributes:
        qualifier: The relation qualifier (empty string when none applies).
        qualifiers: The qualifiers aggregated under a (source, target) pair. For
            aggregated rows (``with_qualifier=False``) this lists every qualifier;
            for per-qualifier rows it is the single-element list ``[qualifier]``.
        source: The source object or event type.
        target: The target object or event type.
        min_count: The minimum number of related items for any source instance.
        max_count: The maximum number of related items for any source instance.
        sum: The total number of relation occurrences across all instances.
    """

    qualifier: str
    qualifiers: list[str] = []
    source: str
    target: str
    min_count: int
    max_count: int
    sum: int

    @classmethod
    def from_summary(
        cls,
        summary: pd.DataFrame,
        qualifiers_map: dict[tuple[str, str], list[str]] | None = None,
    ) -> list[Self]:
        """
        Convert a relation summary DataFrame (as returned by ``O2OManager.summary``
        or ``E2OManager.summary``) into a list of ``RelationCountSummary``.

        The summary is read positionally from its index: level 0 is the source
        type, level 1 the target type, and level 2 (if present) the qualifier.

        ``qualifiers_map`` provides, for aggregated rows, the list of qualifiers
        present for each ``(source, target)`` pair.
        """
        has_qualifier = summary.index.nlevels >= 3

        summaries: list[Self] = []
        for index, row in summary.iterrows():
            key = cast(
                "tuple[str, ...]", index if isinstance(index, tuple) else (index,)
            )
            source = str(key[0])
            target = str(key[1])
            qualifier = str(key[2]) if has_qualifier else ""
            summaries.append(
                cls(
                    source=source,
                    target=target,
                    qualifier=qualifier,
                    qualifiers=(
                        [qualifier]
                        if has_qualifier
                        else (
                            qualifiers_map.get((source, target), [])
                            if qualifiers_map is not None
                            else []
                        )
                    ),
                    min_count=cast(int, row["min"]),
                    max_count=cast(int, row["max"]),
                    sum=cast(int, row["sum"]),
                )
            )

        return summaries
