from dataclasses import dataclass
from typing import Callable, Optional, Type, TypeVar, get_type_hints
import hashlib

import json
from pydantic.main import BaseModel

from outputs.vizualizations import Visualization
from .base import OutputBase


T = TypeVar("T", bound=OutputBase)


@dataclass
class OutputRegistryEntry:
    type: str
    label: str
    shema_hash: str
    model_cls: Type[OutputBase]


class OutputRegistry:
    def __init__(self) -> None:
        self.outputs: dict[str, OutputRegistryEntry] = {}
        self._visualizers: dict[str, Callable] = {}

    def _schema_hash(self, cls: type[BaseModel]) -> str:
        schema = json.dumps(cls.model_json_schema(), sort_keys=True)
        return hashlib.sha256(schema.encode()).hexdigest()

    def register_output(self, label: Optional[str] = None):
        def decorator(cls: type[T]):
            output_type = cls.model_fields["type"].default
            output_hash = self._schema_hash(cls)

            if (
                output_type in self.outputs
                and self.outputs[output_type].shema_hash != output_hash
            ):
                raise ValueError(
                    f"Conflicting output definition for type '{output_type}'.\n"
                    f"Previous schema differs from new one."
                )

            if output_type not in self.outputs:
                self.outputs[output_type] = OutputRegistryEntry(
                    type=output_type,
                    label=label or output_type,
                    shema_hash=output_hash,
                    model_cls=cls,
                )

            return cls

        return decorator

    def register_visualizer(self):
        def decorator(fn: Callable[[T], Visualization]):
            hints = get_type_hints(fn)

            param_types = list(hints.values())

            if not param_types:
                raise TypeError("Visualizer function must accept one argument")

            output_cls = param_types[0]

            if not issubclass(output_cls, OutputBase):
                raise TypeError("Visualizer argument must be a subclass of BaseModel")

            output_type = output_cls.model_fields["type"].default

            self._visualizers[output_type] = fn

            return fn

        return decorator

    def visualize(self, output: T) -> Visualization:  # type:ignore
        if output.type not in self._visualizers:  # type:ignore
            raise ValueError("No registered vizualizations found")

        return self._visualizers[output.type](output)  # type:ignore

    def get_registred_outputs(self):
        print(self.outputs)
        print(self._visualizers)
