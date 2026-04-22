from __future__ import annotations

from typing import Any, Callable

from ocelescope.discovery.pm4py import discover_ocdfg, discover_ocpn
from ocelescope.ocel import OCEL
from ocelescope.resource import DirectlyFollowsGraph, PetriNet, Resource

ResourceDiscoverer = Callable[..., Resource]


class DiscoveryRegistry:
    def __init__(self) -> None:
        self._discoverers: dict[str, ResourceDiscoverer] = {}

    def register(self, resource_type: str, discoverer: ResourceDiscoverer) -> None:
        self._discoverers[resource_type] = discoverer

    def discover(self, resource_type: str, ocel: OCEL, **parameters: Any) -> Resource:
        discoverer = self._discoverers.get(resource_type)
        if discoverer is None:
            raise KeyError(f"Resource '{resource_type}' does not support discovery")

        return discoverer(ocel=ocel, **parameters)


discovery_registry = DiscoveryRegistry()
discovery_registry.register(PetriNet.get_type(), discover_ocpn)
discovery_registry.register(DirectlyFollowsGraph.get_type(), discover_ocdfg)


def discover_resource(resource_type: str, ocel: OCEL, **parameters: Any) -> Resource:
    return discovery_registry.discover(resource_type=resource_type, ocel=ocel, **parameters)
