import inspect
from dataclasses import dataclass
from types import ModuleType
from typing import Any, Callable, get_type_hints
from uuid import uuid4

from ocelescope.discovery import DiscoveryMethodMeta
from ocelescope.ocel import OCEL
from ocelescope.resource import Resource
from pydantic import BaseModel, ConfigDict, create_model


def _snake_to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


def _build_parameter_model(func: Callable[..., Resource]) -> type[BaseModel]:
    """Build a pydantic model that describes the function's non-OCEL parameters."""
    sig = inspect.signature(func)
    hints = get_type_hints(func, include_extras=True)

    fields: dict[str, tuple[Any, Any]] = {}
    for name, param in sig.parameters.items():
        if name in ("ocel", "self"):
            continue
        annotation = hints.get(name, param.annotation)
        default = param.default if param.default is not inspect.Parameter.empty else ...
        fields[name] = (annotation, default)

    config = ConfigDict(
        alias_generator=_snake_to_camel,
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

    model_name = f"{func.__name__.title().replace('_', '')}Parameters"  # ty: ignore[unresolved-attribute]
    return create_model(model_name, __config__=config, **fields)  # type: ignore[call-overload]  # ty: ignore[no-matching-overload]


@dataclass
class DiscoveryMethodInfo:
    method_id: str
    name: str
    description: str | None
    func: Callable[..., Resource]
    parameter_type: type[BaseModel]
    resource_type: type[Resource]
    plugin_id: str
    enabled: bool = True

    def parameters_schema(self) -> dict[str, Any]:
        return self.parameter_type.model_json_schema(by_alias=True)

    def parse_parameters(self, data: dict[str, Any]) -> BaseModel:
        return self.parameter_type.model_validate(data)

    def dump_parameters(self, params: BaseModel) -> dict[str, Any]:
        return params.model_dump(by_alias=False)

    def run(self, *, ocel: OCEL, parameters: BaseModel) -> Resource:
        return self.func(ocel=ocel, **parameters.model_dump(by_alias=False))


class DiscoveryMethodGroup:
    def __init__(
        self,
        name: str,
        variants: list[DiscoveryMethodInfo],
    ) -> None:
        self.name = name
        self.variants = variants


class DiscoveryRegistry:
    def __init__(self) -> None:
        self._methods: dict[str, DiscoveryMethodInfo] = {}

    def register(self, module: ModuleType) -> list[DiscoveryMethodInfo]:
        registered: list[DiscoveryMethodInfo] = []
        for value in vars(module).values():
            meta = getattr(value, "__discovery_meta__", None)
            if isinstance(meta, DiscoveryMethodMeta):
                registered.append(self._register_meta(meta, plugin_id=module.__name__))
        return registered

    def _register_meta(
        self, meta: DiscoveryMethodMeta, plugin_id: str
    ) -> DiscoveryMethodInfo:
        parameter_type = _build_parameter_model(meta.func)

        for existing in self._methods.values():
            if (
                existing.name == meta.name
                and existing.resource_type is meta.resource_type
            ):
                raise TypeError(
                    f"Discovery method '{meta.name}' is already registered for resource "
                    f"type '{meta.resource_type.get_type()}'."
                )

        info = DiscoveryMethodInfo(
            method_id=str(uuid4()),
            name=meta.name,
            description=meta.description,
            func=meta.func,
            parameter_type=parameter_type,
            resource_type=meta.resource_type,
            plugin_id=plugin_id,
        )
        self._methods[info.method_id] = info
        return info

    def disable(self, method_id: str) -> None:
        info = self._methods.get(method_id)
        if info is not None:
            info.enabled = False

    def enable(self, method_id: str) -> None:
        info = self._methods.get(method_id)
        if info is not None:
            info.enabled = True

    def unload_module(self, plugin_id: str) -> None:
        for method_id, info in list(self._methods.items()):
            if info.plugin_id == plugin_id:
                del self._methods[method_id]

    def get(self, method_id: str) -> DiscoveryMethodInfo:
        info = self._methods.get(method_id)
        if info is None or not info.enabled:
            raise KeyError(
                f"Discovery method '{method_id}' is not registered or is disabled"
            )
        return info

    def list_groups(self) -> list[DiscoveryMethodGroup]:
        groups: dict[str, DiscoveryMethodGroup] = {}
        for info in self._methods.values():
            if info.name not in groups:
                groups[info.name] = DiscoveryMethodGroup(
                    name=info.name,
                    variants=[info],
                )
            else:
                groups[info.name].variants.append(info)
        return list(groups.values())
