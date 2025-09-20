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
    shema_hash: str
    model_classes: list[tuple[str, Type[Resource]]]
    label: str | None = None
    description: str | None = None


class ResourceRegistry:
    def __init__(self) -> None:
        self.resources: dict[str, ResourceRegistryEntry] = {}

    def _schema_hash(self, cls: type[BaseModel]) -> str:
        schema = json.dumps(cls.model_json_schema(), sort_keys=True)
        return hashlib.sha256(schema.encode()).hexdigest()

    def register_resource(self, plugin_id: str, resource_class: type[T]):
        resource_type = resource_class.get_type()
        resource_hash = self._schema_hash(resource_class)

        if (
            resource_type in self.resources
            and self.resources[resource_type].shema_hash != resource_hash
        ):
            raise ValueError(
                f"Conflicting output definition for type '{resource_hash}'.\n"
                f"Previous schema differs from new one."
            )

        if resource_type not in self.resources:
            self.resources[resource_type] = ResourceRegistryEntry(
                type=resource_type,
                label=resource_class.label,
                description=resource_class.description,
                shema_hash=resource_hash,
                model_classes=[(plugin_id, resource_class)],
            )
        elif not any(
            plugin_id == existing_plugin_id
            for existing_plugin_id, _ in self.resources[resource_type].model_classes
        ):
            self.resources[resource_type].model_classes.append(
                (plugin_id, resource_class)
            )

    def get_resource_class(
        self, resource_type: str, plugin_id: str | None = None
    ) -> type[Resource] | None:
        entry = self.resources.get(resource_type)

        if entry:
            return next(
                (
                    model_cls
                    for (id, model_cls) in entry.model_classes
                    if not plugin_id or id == plugin_id
                ),
                None,
            )

    def unload_module(self, plugin_id: str):
        to_delete = []
        for resource_type, entry in self.resources.items():
            entry.model_classes = [
                (id, resource_class)
                for (id, resource_class) in entry.model_classes
                if id != plugin_id
            ]
            if len(entry.model_classes) == 0:
                to_delete.append(resource_type)

        for resource_type in to_delete:
            del self.resources[resource_type]


resource_registry = ResourceRegistry()
