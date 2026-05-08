from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, ClassVar, Generic, TypeVar, cast, get_args, get_origin

from pydantic import BaseModel, ConfigDict, Field

from ocelescope.ocel import OCEL
from ocelescope.resource import Resource


def _snake_to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class DiscoveryParameters(BaseModel):
    model_config = ConfigDict(
        alias_generator=_snake_to_camel,
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


def discovery_field(
    *,
    title: str,
    description: str | None = None,
    field_type: str | None = None,
):
    json_schema_extra = {"x-ui-meta": {"field_type": field_type}} if field_type else None
    return Field(
        default_factory=list,
        title=title,
        description=description,
        json_schema_extra=json_schema_extra,  # type: ignore[arg-type]
    )


def discovery_percentage_field(
    *,
    title: str,
    description: str | None = None,
):
    return Field(
        default=0,
        ge=0,
        le=100,
        title=title,
        description=description,
    )


class FilteredDiscoveryParameters(DiscoveryParameters):
    excluded_event_types: list[str] = discovery_field(
        title="Excluded Activities",
        description="Activities that should be ignored before discovery.",
        field_type="event_type",
    )
    excluded_object_types: list[str] = discovery_field(
        title="Excluded Object Types",
        description="Object types that should be ignored before discovery.",
        field_type="object_type",
    )
    activity_frequency_threshold: int = discovery_percentage_field(
        title="Activity Frequency",
        description=(
            "Keep only activities whose frequency is at least this percentage "
            "of the most frequent activity."
        ),
    )
    object_frequency_threshold: int = discovery_percentage_field(
        title="Object Frequency",
        description=(
            "Keep only object types whose frequency is at least this percentage "
            "of the most frequent object type."
        ),
    )


ParametersT = TypeVar("ParametersT", bound=DiscoveryParameters)
ResourceT = TypeVar("ResourceT", bound=Resource)


class DiscoveryAlgorithm(ABC, Generic[ParametersT, ResourceT]):
    name: ClassVar[str]
    description: ClassVar[str | None] = None
    _parameter_model: ClassVar[type[DiscoveryParameters]]
    _resource_model: ClassVar[type[Resource]]

    def __init_subclass__(cls) -> None:
        super().__init_subclass__()

        for base in getattr(cls, "__orig_bases__", ()):
            if get_origin(base) is DiscoveryAlgorithm:
                parameter_model, resource_model = get_args(base)
                cls._parameter_model = parameter_model
                cls._resource_model = resource_model
                return

    @classmethod
    def parameter_model(cls) -> type[ParametersT]:
        return cast(type[ParametersT], cls._parameter_model)

    @classmethod
    def resource_model(cls) -> type[ResourceT]:
        return cast(type[ResourceT], cls._resource_model)

    @classmethod
    def resource_type(cls) -> str:
        return cls._resource_model.get_type()

    @classmethod
    def parse_parameters(cls, parameters: dict[str, Any]) -> ParametersT:
        return cls.parameter_model().model_validate(parameters)

    @classmethod
    def dump_parameters(cls, parameters: ParametersT) -> dict[str, Any]:
        return cls.parameter_model().model_validate(parameters).model_dump(by_alias=False)

    @classmethod
    def parameters_schema(cls) -> dict[str, Any]:
        return cls.parameter_model().model_json_schema(by_alias=True)

    @classmethod
    def run_untyped(cls, *, ocel: OCEL, parameters: DiscoveryParameters) -> Resource:
        return cls.run(
            ocel=ocel,
            parameters=cls.parameter_model().model_validate(parameters),
        )

    @classmethod
    @abstractmethod
    def run(cls, *, ocel: OCEL, parameters: ParametersT) -> ResourceT:
        raise NotImplementedError
