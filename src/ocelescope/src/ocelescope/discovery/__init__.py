from ocelescope.discovery.algorithms.dfg_miner import ocdfg_miner
from ocelescope.discovery.algorithms.inductive_miner import inductive_miner
from ocelescope.discovery.decorator import DiscoveryMethodMeta, discovery_method

__all__ = [
    "DiscoveryMethodMeta",
    "discovery_method",
    "inductive_miner",
    "ocdfg_miner",
]
