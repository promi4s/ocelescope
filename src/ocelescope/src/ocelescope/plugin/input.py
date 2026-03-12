from abc import ABC
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class PluginInput(ABC, BaseModel):
    pass


def OCEL_FIELD(
    *,
    field_type: Literal[
        "object_type",
        "event_type",
        "event_id",
        "object_id",
        "event_attribute",
        "object_attribute",
        "time_frame",
    ],
    ocel_id: str,
    default: Any = ...,
    title: Optional[str] = None,
    description: Optional[str] = None,
) -> Any:
    """Create a Pydantic `Field` with Ocelescope UI metadata for OCEL-based inputs.

    Args:
        field_type: What kind of OCEL field the user should select (e.g.
            `"event_attribute"` or `"object_type"`).
        ocel_id: Identifier/name of the OCEL input this field depends on.
        default: Default value, or `...` to make the field required.
        title: Optional UI title for the field.
        description: Optional UI help text for the field.
    """
    extra: dict[str, Any] = {
        "type": "ocel",
        "field_type": field_type,
        "ocel_id": ocel_id,
    }

    return Field(
        default=default,
        title=title,
        description=description,
        json_schema_extra={"x-ui-meta": extra},
    )


def COMPUTED_SELECTION(
    *,
    title: Optional[str] = None,
    description: Optional[str] = None,
    provider: str,
    depends_on: list[str] | None = None,
    default: Any = ...,
):
    """Create a Pydantic `Field` for a UI selection computed by a provider.

    Args:
        title: Optional UI title for the field.
        description: Optional UI help text for the field.
        provider: The name (ID) of the provider function used by the frontend to compute the available options.
        depends_on: Optional list of field names this selection depends on.
        default: Default value, or `...` to make the field required.

    """
    meta = {
        "type": "computed_select",
        "provider": provider,
        "dependsOn": depends_on or [],
    }

    return Field(
        default=default,
        title=title,
        description=description,
        json_schema_extra={"x-ui-meta": meta},
    )
