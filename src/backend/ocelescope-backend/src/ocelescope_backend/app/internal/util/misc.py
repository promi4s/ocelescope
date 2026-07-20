from typing import Hashable, Iterable, TypeVar

T = TypeVar("T", bound=Hashable)


def unique(xs: Iterable[T]):
    return list(dict.fromkeys(xs))


def set_str(xs: list[str] | set[str], empty_rep: str = "---"):
    """Joins a set or list to a comma-separated string of unique elements, or "---" if empty."""
    if isinstance(xs, list):
        # Keep unique elements but preserve order
        xs = list(dict.fromkeys(xs))
    elif isinstance(xs, set):
        xs = sorted(xs)

    return ", ".join(xs) if xs else empty_rep
