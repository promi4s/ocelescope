from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from ocelescope.ocel.filter.base import BaseFilter


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
        title="Activity Frequency Threshold",
        description=(
            "Frequency threshold for activities, as a percentage of all events. "
            "Loop iterations count individually."
        ),
    )
    activity_frequency_mode: Literal["include", "exclude"] = select_field(
        default="include",
        title="Activity Frequency Mode",
        description="Whether to keep or remove activities that meet the frequency threshold.",
        options={"include": "Keep frequent", "exclude": "Remove frequent"},
    )
    object_frequency_threshold: int = discovery_percentage_field(
        title="Object Type Frequency Threshold",
        description=("Frequency threshold for object types, as a percentage of all objects."),
    )
    object_frequency_mode: Literal["include", "exclude"] = select_field(
        default="include",
        title="Object Type Frequency Mode",
        description="Whether to keep or remove object types that meet the frequency threshold.",
        options={"include": "Keep frequent", "exclude": "Remove frequent"},
    )

    def build_filter_pipeline(self) -> list[BaseFilter]:
        from ocelescope.ocel.filter.filters.entity_type import EventTypeFilter, ObjectTypeFilter
        from ocelescope.ocel.filter.filters.frequency import (
            EventTypeFrequencyFilter,
            ObjectTypeFrequencyFilter,
        )

        return [
            EventTypeFilter(event_types=self.excluded_event_types, mode="exclude"),
            ObjectTypeFilter(object_types=self.excluded_object_types, mode="exclude"),
            EventTypeFrequencyFilter(
                threshold_percentage=self.activity_frequency_threshold,
                mode=self.activity_frequency_mode,
            ),
            ObjectTypeFrequencyFilter(
                threshold_percentage=self.object_frequency_threshold,
                mode=self.object_frequency_mode,
            ),
        ]
