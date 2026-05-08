from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from ocelescope.discovery.algorithm import DiscoveryAlgorithm
from ocelescope.discovery.algorithms import PM4PyObjectCentricDFG, PM4PyObjectCentricInductiveMiner


@dataclass(frozen=True)
class RegisteredDiscoveryAlgorithm:
    method_id: str
    algorithm: type[DiscoveryAlgorithm[Any, Any]]

    @property
    def resource_type(self) -> str:
        return self.algorithm.resource_type()

    @property
    def name(self) -> str:
        return self.algorithm.name

    @property
    def description(self) -> str | None:
        return self.algorithm.description

    def parse_parameters(self, parameters: dict[str, Any]):
        return self.algorithm.parse_parameters(parameters)

    def dump_parameters(self, parameters) -> dict[str, Any]:
        return self.algorithm.dump_parameters(parameters)

    def parameters_schema(self) -> dict[str, Any]:
        return self.algorithm.parameters_schema()

    def run_untyped(self, **kwargs):
        return self.algorithm.run_untyped(**kwargs)


class DiscoveryRegistry:
    def __init__(self) -> None:
        self._algorithms: dict[str, RegisteredDiscoveryAlgorithm] = {}

    def register(
        self,
        algorithm: type[DiscoveryAlgorithm[Any, Any]],
    ) -> None:
        method_id = str(uuid4())
        self._algorithms[method_id] = RegisteredDiscoveryAlgorithm(
            method_id=method_id,
            algorithm=algorithm,
        )

    def get(self, method_id: str) -> RegisteredDiscoveryAlgorithm:
        algorithm = self._algorithms.get(method_id)
        if algorithm is None:
            raise KeyError(f"Discovery method '{method_id}' is not registered")
        return algorithm

    def list_algorithms(self) -> list[RegisteredDiscoveryAlgorithm]:
        return list(self._algorithms.values())


discovery_registry = DiscoveryRegistry()
discovery_registry.register(PM4PyObjectCentricInductiveMiner)
discovery_registry.register(PM4PyObjectCentricDFG)
