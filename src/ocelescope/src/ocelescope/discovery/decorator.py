from dataclasses import dataclass
from typing import Any, Callable, get_type_hints

from ocelescope.resource import Resource


@dataclass
class DiscoveryMethodMeta:
    name: str
    description: str | None
    func: Callable[..., Resource]
    resource_type: type[Resource]


def discovery_method(
    *,
    name: str,
    description: str | None = None,
) -> Callable[[Callable[..., Resource]], Callable[..., Resource]]:
    """Mark a function as a discovery method.

    Stamps `__discovery_meta__` on the function. The backend scans for this
    attribute at startup, derives the parameter schema from the function
    signature, and exposes the method through the discovery API.
    """

    def decorator(func: Callable[..., Resource]) -> Callable[..., Resource]:
        hints = get_type_hints(func, include_extras=True)
        resource_type = _extract_resource_type(func.__name__, hints.get("return"))  # ty: ignore[unresolved-attribute]

        func.__discovery_meta__ = DiscoveryMethodMeta(  # type: ignore[attr-defined]  # ty: ignore[unresolved-attribute]
            name=name,
            description=description,
            func=func,
            resource_type=resource_type,
        )
        return func

    return decorator


def _extract_resource_type(func_name: str, annotation: Any) -> type[Resource]:
    if annotation is None:
        raise TypeError(f"@discovery_method on '{func_name}': missing return type annotation")

    if isinstance(annotation, type) and issubclass(annotation, Resource):
        return annotation

    raise TypeError(
        f"@discovery_method on '{func_name}': return type must be a Resource subclass, got {annotation}"
    )
