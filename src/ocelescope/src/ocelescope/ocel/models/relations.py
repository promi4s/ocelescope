from dataclasses import dataclass


@dataclass
class RelationCountSummary:
    """
    Summary statistics for relationship multiplicities in O2O or E2O relations.

    This structure captures how many related objects (or events) occur for each
    combination of source type, target type, and qualifier. It is typically used
    in relation summaries such as those produced by O2OManager.summary or
    E2OManager.summary.

    Attributes:
        qualifier (str):
            The relation qualifier (e.g., role, relationship type) used in the
            OCEL relation. For O2O this is often empty; for E2O this may describe
            the nature of the event–object link.
        source (str):
            The source object or event type associated with the relation.
        target (str):
            The target object or event type associated with the relation.
        min_count (int):
            The minimum number of related items observed for any source instance.
        max_count (int):
            The maximum number of related items observed for any source instance.
        sum (int):
            The total number of relation occurrences across all instances.
    """

    qualifier: str
    source: str
    target: str
    min_count: int
    max_count: int
    sum: int
