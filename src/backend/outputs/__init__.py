from .base import OutputBase
from .vizualizations import Visualization
from .registry import OutputRegistry

output_registry = OutputRegistry()

register_output = output_registry.register_output
register_visulization = output_registry.register_visualizer

__all__ = [
    "OutputBase",
    "Visualization",
    "output_registry",
    "register_output",
    "register_visulization",
]
