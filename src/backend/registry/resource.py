from ocelescope import Resource

from dataclasses import dataclass
from typing import Type, TypeVar
import hashlib

import json
from pydantic.main import BaseModel


T = TypeVar("T", bound=Resource)


@dataclass
class ResourceRegistryEntry:
    type: str
    label: str
    shema_hash: str
    model_cls: Type[Resource]


class ResourceRegistry:
    def __init__(self) -> None:
        self.resources: dict[str, ResourceRegistryEntry] = {}

    def _schema_hash(self, cls: type[BaseModel]) -> str:
        schema = json.dumps(cls.model_json_schema(), sort_keys=True)
        return hashlib.sha256(schema.encode()).hexdigest()

    def register_resource(self, resource_class: type[T]):
        resource_type = resource_class.model_fields["type"].default
        resource_hash = self._schema_hash(resource_class)

        if (
            resource_type in self.resources.values()
            and self.resources[resource_type].shema_hash != resource_hash
        ):
            raise ValueError(
                f"Conflicting output definition for type '{resource_hash}'.\n"
                f"Previous schema differs from new one."
            )

        if resource_type not in self.resources:
            self.resources[resource_type] = ResourceRegistryEntry(
                type=resource_type,
                label=resource_type,
                shema_hash=resource_hash,
                model_cls=resource_class,
            )


resource_registry = ResourceRegistry()
