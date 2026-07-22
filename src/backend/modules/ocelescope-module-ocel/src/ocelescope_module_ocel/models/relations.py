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


class RelationCountSummary(BaseModel):
    """Summary statistics for relationship multiplicities in O2O or E2O relations.

    For each (source type, target type[, qualifier]) combination, captures how many
    related items occur per source instance.

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
