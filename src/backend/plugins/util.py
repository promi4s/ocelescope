from typing import Any, Optional, Literal
from pydantic import Field


def ocel_field(
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
