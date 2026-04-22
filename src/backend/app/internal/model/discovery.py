from typing import Any, Literal, TypeAlias

from pydantic import BaseModel, Field

from app.internal.model.base import ApiBaseModel, RequestBody

DiscoveryResourceType: TypeAlias = Literal["PetriNet", "DirectlyFollowsGraph"]


def DISCOVERY_FIELD(
    *,
    title: str,
    description: str | None = None,
    field_type: str | None = None,
):
    json_schema_extra = (
        {"x-ui-meta": {"field_type": field_type}} if field_type else None
    )
    return Field(
        default_factory=list,
        title=title,
        description=description,
        json_schema_extra=json_schema_extra,  # type: ignore
    )


class DiscoveryRequest(BaseModel):
    ocel_id: str
    resource_type: DiscoveryResourceType
    parameters: dict[str, Any] = Field(default_factory=dict)


class DiscoveryMethodMeta(ApiBaseModel):
    resource_type: DiscoveryResourceType
    label: str
    description: str | None = None
    input_schema: dict[str, Any]


class DiscoverPetriNetBody(RequestBody):
    variant: Literal["im", "imd"] = Field(
        default="im",
        title="Mining Variant",
        description="Choose the inductive mining variant used for discovery.",
        json_schema_extra={"enumNames": ["IM (traditional)", "IMd (directly-follows)"]},
    )
    excluded_event_types: list[str] = DISCOVERY_FIELD(
        title="Excluded Activities",
        description="Activities that should be ignored before discovery.",
        field_type="event_type",
    )
    excluded_object_types: list[str] = DISCOVERY_FIELD(
        title="Excluded Object Types",
        description="Object types that should be ignored before discovery.",
        field_type="object_type",
    )


class DiscoverDFGBody(RequestBody):
    excluded_event_types: list[str] = DISCOVERY_FIELD(
        title="Excluded Activities",
        description="Activities that should be ignored before discovery.",
        field_type="event_type",
    )
    excluded_object_types: list[str] = DISCOVERY_FIELD(
        title="Excluded Object Types",
        description="Object types that should be ignored before discovery.",
        field_type="object_type",
    )
