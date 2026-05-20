from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


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
) -> Any:
    json_schema_extra: dict[str, Any] | None = (
        {"x-ui-meta": {"field_type": field_type}} if field_type else None
    )
    return Field(
        default_factory=list,
        title=title,
        description=description,
        json_schema_extra=json_schema_extra,
    )


def discovery_percentage_field(
    *,
    title: str,
    description: str | None = None,
) -> Any:
    return Field(
        default=0,
        ge=0,
        le=100,
        title=title,
        description=description,
    )


def select_field(
    *,
    default: str,
    title: str,
    description: str | None = None,
    options: dict[str, str],
) -> Any:
    return Field(
        default=default,
        title=title,
        description=description,
        json_schema_extra={"enumNames": list(options.values())},
    )


class FilteredDiscoveryParameters(DiscoveryParameters):
    excluded_event_types: list[str] = discovery_field(
        title="Exclude Activities",
        description="Activities that should be ignored before discovery.",
        field_type="event_type",
    )
    excluded_object_types: list[str] = discovery_field(
        title="Exclude Object Types",
        description="Object types that should be ignored before discovery.",
        field_type="object_type",
    )
    activity_frequency_threshold: int = discovery_percentage_field(
        title="Activity Threshold",
        description=(
            "Keep only activities whose frequency is at least this percentage "
            "of the most frequent activity."
        ),
    )
    object_frequency_threshold: int = discovery_percentage_field(
        title="Object Threshold",
        description=(
            "Keep only object types whose frequency is at least this percentage "
            "of the most frequent object type."
        ),
    )
