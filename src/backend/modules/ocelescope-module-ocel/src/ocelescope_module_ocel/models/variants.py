from pydantic import BaseModel


class ObjectVariant(BaseModel):
    """A single object variant: a distinct activity sequence objects of a type follow.

    Attributes:
        variant_id: Identifier of the variant (``<object_type>_<index>``).
        activities: The ordered activity sequence that defines the variant.
        event_count: Number of events in the variant (length of ``activities``).
        case_count: Number of objects (cases) that follow this variant.
    """

    variant_id: str
    activities: list[str]
    event_count: int
    case_count: int


class ObjectTypeVariants(BaseModel):
    """All variants of a single object type together with the totals across them.

    Attributes:
        variants: The distinct variants, sorted by frequency (descending).
        case_count: Total number of cases (objects) of the object type.
        event_count: Total number of events across all cases of the object type.
    """

    variants: list[ObjectVariant]
    case_count: int
    event_count: int
