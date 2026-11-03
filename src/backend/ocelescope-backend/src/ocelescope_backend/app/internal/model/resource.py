from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path
from typing import Literal

from ocelescope.resource.tabular import COLUMN_TYPE
from ocelescope.visualization.default.table import TableDataType
from pydantic import BaseModel, Field, GetJsonSchemaHandler
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import CoreSchema

from ocelescope import (
    DirectlyFollowsGraph,
    OCELMapping,
    PetriNet,
    ResourceBase,
    Table,
    TableColumn,
    TabularResource,
)

COLUMN_DATA_TYPES: dict[COLUMN_TYPE, TableDataType] = {
    "int": "number",
    "float": "number",
    "str": "string",
    "timestamp": "datetime",
    "bool": "boolean",
    "date": "date",
}


class DefaultResource(StrEnum):
    DirectlyFollowsGraph = DirectlyFollowsGraph.get_schema_hash()
    OCELMapping = OCELMapping.get_schema_hash()
    PetriNet = PetriNet.get_schema_hash()

    @classmethod
    def __get_pydantic_json_schema__(
        cls, core_schema: CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        json_schema = handler.resolve_ref_schema(handler(core_schema))
        json_schema["x-enum-varnames"] = [member.name for member in cls]
        return json_schema


class ResourceTable(BaseModel):
    name: str
    columns: list[TableColumn]

    @classmethod
    def from_table(
        cls, name: str, table: Table, resource: TabularResource
    ) -> "ResourceTable":
        return cls(
            name=name,
            columns=[
                TableColumn(id=column_name, data_type=COLUMN_DATA_TYPES[column_type])
                for column_name, column_type in [
                    *table.schema,
                    *table.get_extra_columns(resource.con),
                ]
            ],
        )

    @classmethod
    def from_resource(cls, resource: TabularResource) -> "list[ResourceTable]":
        return [
            cls.from_table(name, table, resource)
            for name, table in resource.tables.items()
        ]


class ResourceInfo(BaseModel):
    """Ocelescope-owned metadata of a resource held by a session."""

    name: str
    created_at: str = Field(default_factory=lambda: datetime.now(tz=UTC).isoformat())
    source_id: str | None = None


class ResourceTypeInfo(BaseModel):
    label: str
    description: str | None

    @classmethod
    def from_resource_type(
        cls, resource_type: type[ResourceBase]
    ) -> "ResourceTypeInfo":
        return cls(
            label=resource_type.get_label(), description=resource_type.description
        )


class ResourceHeader(ResourceInfo):
    schema_hash: str


class ResourceStore(ResourceHeader):
    """A resource dumped into its own file at ``path``, e.g. by a session."""

    path: Path
    hidden: bool = False

    def delete(self) -> None:
        self.path.unlink(missing_ok=True)


class ResourceApi(ResourceHeader):
    id: str
    resource_type_label: str
    kind: Literal["tabular", "json"]
    has_visualization: bool

    @classmethod
    def from_store(
        cls, id: str, store: ResourceStore, resource_type: type[ResourceBase]
    ) -> "ResourceApi":
        return cls(
            id=id,
            resource_type_label=resource_type.get_label(),
            kind="tabular" if issubclass(resource_type, TabularResource) else "json",
            has_visualization=resource_type.has_visualization(),
            **store.model_dump(),
        )
