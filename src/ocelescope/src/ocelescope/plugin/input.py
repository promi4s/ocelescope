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
        "e2o_qualifier",
        "o2o_qualifier",
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


def SLIDER_FIELD(
    *,
    min: float,
    max: float,
    step: Optional[float] = None,
    marks: Optional[list[float]] = None,
    title: Optional[str] = None,
    description: Optional[str] = None,
    default: Any = ...,
) -> Any:
    """Create a Pydantic `Field` rendered as a slider.

    `min` and `max` become real `ge`/`le` constraints, not just UI bounds, so a
    value outside the range is rejected on validation rather than only being
    unreachable by dragging.

    Annotate the field as `int` to get whole-number steps, or `float` for
    fractional ones.

    Args:
        min: Lowest selectable value.
        max: Highest selectable value.
        step: Increment between selectable values. Defaults to 1 for `int`
            fields and to a hundredth of the range for `float` fields.
        marks: Optional values to label on the track.
        title: Optional UI title for the field.
        description: Optional UI help text for the field.
        default: Default value, or `...` to make the field required.
    """
    meta: dict[str, Any] = {"type": "slider", "min": min, "max": max}

    if step is not None:
        meta["step"] = step
    if marks:
        meta["marks"] = marks

    return Field(
        default=default,
        title=title,
        description=description,
        ge=min,
        le=max,
        json_schema_extra={"x-ui-meta": meta},
    )


def CODE_FIELD(
    *,
    language: str,
    title: Optional[str] = None,
    description: Optional[str] = None,
    default: Any = ...,
) -> Any:
    """Create a Pydantic `Field` rendered as a code editor.

    The value is a plain string; syntax highlighting is presentation only, so the
    plugin stays responsible for validating what the user typed.

    Args:
        language: Language id used for highlighting, as understood by the
            frontend's editor -- for example `"sql"`, `"python"`, `"json"`,
            `"yaml"` or `"xml"`. An unknown id degrades to plain text.
        title: Optional UI title for the field.
        description: Optional UI help text for the field.
        default: Default value, or `...` to make the field required.
    """
    return Field(
        default=default,
        title=title,
        description=description,
        json_schema_extra={"x-ui-meta": {"type": "code", "language": language}},
    )


def SQL_FIELD(
    *,
    title: Optional[str] = None,
    description: Optional[str] = None,
    default: Any = ...,
) -> Any:
    """Create a Pydantic `Field` rendered as a SQL editor.

    Shorthand for `CODE_FIELD(language="sql")`.

    Args:
        title: Optional UI title for the field.
        description: Optional UI help text for the field.
        default: Default value, or `...` to make the field required.
    """
    return CODE_FIELD(
        language="sql",
        title=title,
        description=description,
        default=default,
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
