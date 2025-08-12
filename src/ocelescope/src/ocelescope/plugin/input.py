from abc import ABC
from typing import Any, Optional, Literal
from pydantic import BaseModel, Field


class PluginInput(ABC, BaseModel, frozen=True):
    pass


def OCEL_FIELD(
    *,
    field_type: Literal["object_type", "event_type"],
    ocel_id: str,
    default: Any = ...,
    title: Optional[str] = None,
    description: Optional[str] = None,
) -> Any:
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
