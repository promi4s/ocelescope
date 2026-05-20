import inspect
from dataclasses import dataclass
from typing import Any, Callable, get_type_hints
from uuid import uuid4

from ocelescope.discovery.algorithm import DiscoveryParameters
from ocelescope.ocel import OCEL
from ocelescope.resource import Resource


@dataclass
class DiscoveryMethodInfo:
    method_id: str
    name: str
    description: str | None
    func: Callable[..., Resource]
    parameter_type: type[DiscoveryParameters]
    resource_type: type[Resource]

    def parameters_schema(self) -> dict[str, Any]:
        return self.parameter_type.model_json_schema(by_alias=True)

    def parse_parameters(self, data: dict[str, Any]) -> DiscoveryParameters:
        return self.parameter_type.model_validate(data)

    def dump_parameters(self, params: DiscoveryParameters) -> dict[str, Any]:
        return params.model_dump(by_alias=False)

    def run(self, *, ocel: OCEL, parameters: DiscoveryParameters) -> Resource:
        return self.func(ocel=ocel, parameters=parameters)


def discovery_method(
    *,
    name: str,
    description: str | None = None,
) -> Callable[[Callable[..., Resource]], Callable[..., Resource]]:
    def decorator(func: Callable[..., Resource]) -> Callable[..., Resource]:
        hints = get_type_hints(func)
        param_type = _extract_param_type(func, hints)
        resource_type = _extract_resource_type(func.__name__, hints.get("return"))

        info = DiscoveryMethodInfo(
            method_id=str(uuid4()),
            name=name,
            description=description,
            func=func,
            parameter_type=param_type,
            resource_type=resource_type,
        )
        func.__discovery_meta__ = info  # type: ignore[attr-defined]

        from ocelescope.discovery.manager import discovery_registry

        discovery_registry.register(info)

        return func

    return decorator


def _extract_param_type(func: Callable, hints: dict[str, Any]) -> type[DiscoveryParameters]:
    for pname in inspect.signature(func).parameters:
        if pname in ("ocel", "self"):
            continue
        hint = hints.get(pname)
        if hint is not None and isinstance(hint, type) and issubclass(hint, DiscoveryParameters):
            return hint
    raise TypeError(
        f"@discovery_method on '{func.__name__}': no parameter typed as a DiscoveryParameters subclass found"
    )


def _extract_resource_type(func_name: str, annotation: Any) -> type[Resource]:
    if annotation is None:
        raise TypeError(f"@discovery_method on '{func_name}': missing return type annotation")

    if isinstance(annotation, type) and issubclass(annotation, Resource):
        return annotation

    raise TypeError(
        f"@discovery_method on '{func_name}': return type must be a Resource subclass, got {annotation}"
    )
