from typing import Annotated, Any, Literal, Self

from ocelescope.plugin.decorators import PluginIO
from pydantic import BaseModel, Field

from ocelescope import OCEL, Plugin, PluginMethod


class PluginIOApiBase(BaseModel):
    name: str
    label: str
    description: str | None
    is_optional: bool
    is_list: bool

    @classmethod
    def from_plugin_io(cls, io: PluginIO) -> Self:

        return cls(
            name=io.name,
            label=io.label,
            description=io.description,
            is_optional=io.is_optional,
            is_list=io.is_list,
        )


class OCELIOApi(PluginIOApiBase):
    type: Literal["ocel"]


class ResourceIOApi(PluginIOApiBase):
    type: Literal["resource"]
    schema_id: str
    resource_label: str


PluginIOApi = Annotated[OCELIOApi | ResourceIOApi, Field(discriminator="type")]


def _plugin_io_to_api(io: PluginIO):
    base = PluginIOApiBase.from_plugin_io(io)
    return (
        OCELIOApi(type="ocel", **base.model_dump())
        if issubclass(io.type, OCEL)
        else ResourceIOApi(
            type="resource",
            schema_id=io.type.get_schema_hash(),
            resource_label=io.type.get_label(),
            **base.model_dump(),
        )
    )


class MethodApi(BaseModel):
    name: str
    label: str
    description: str | None = None
    inputs: list[PluginIOApi]
    outputs: list[PluginIOApi]
    configuration_schema: dict[str, Any] | None = None

    @classmethod
    def from_method_meta(cls, method: PluginMethod) -> Self:
        return cls(
            name=method.name,
            label=method.label,
            description=method.description,
            inputs=[_plugin_io_to_api(io) for io in method.inputs],
            outputs=[_plugin_io_to_api(io) for io in method.outputs],
            configuration_schema=method.configuration_input.model_json_schema()
            if method.configuration_input
            else None,
        )


class PluginApi(BaseModel):
    id: str
    name: str
    version: str
    label: str
    description: str | None = None
    methods: list[MethodApi]

    @classmethod
    def from_plugin(cls, id: str, plugin: Plugin) -> Self:
        return cls(
            id=id,
            name=plugin.__class__.__name__,
            version=plugin.version,
            label=plugin.label,
            description=plugin.description,
            methods=[
                MethodApi.from_method_meta(method)
                for method in plugin.method_map().values()
            ],
        )
