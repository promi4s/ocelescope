from typing import Any

from ocelescope.discovery.decorator import DiscoveryMethodInfo


class DiscoveryMethodGroup:
    def __init__(
        self,
        name: str,
        description: str | None,
        parameter_type: type,
        variants: list[DiscoveryMethodInfo],
    ) -> None:
        self.name = name
        self.description = description
        self.parameter_type = parameter_type
        self.variants = variants

    def parameters_schema(self) -> dict[str, Any]:
        return self.parameter_type.model_json_schema(by_alias=True)


class DiscoveryRegistry:
    def __init__(self) -> None:
        self._methods: dict[str, DiscoveryMethodInfo] = {}

    def register(self, info: DiscoveryMethodInfo) -> None:
        for existing in self._methods.values():
            if existing.name == info.name and existing.parameter_type is not info.parameter_type:
                raise TypeError(
                    f"Discovery methods with the same name must share the same parameter type. "
                    f"'{info.name}' is already registered with {existing.parameter_type.__name__}, "
                    f"but '{info.func.__name__}' uses {info.parameter_type.__name__}."
                )
        self._methods[info.method_id] = info

    def get(self, method_id: str) -> DiscoveryMethodInfo:
        info = self._methods.get(method_id)
        if info is None:
            raise KeyError(f"Discovery method '{method_id}' is not registered")
        return info

    def list_groups(self) -> list[DiscoveryMethodGroup]:
        groups: dict[str, DiscoveryMethodGroup] = {}
        for info in self._methods.values():
            if info.name not in groups:
                groups[info.name] = DiscoveryMethodGroup(
                    name=info.name,
                    description=info.description,
                    parameter_type=info.parameter_type,
                    variants=[info],
                )
            else:
                groups[info.name].variants.append(info)
        return list(groups.values())


discovery_registry = DiscoveryRegistry()
