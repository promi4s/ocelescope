from __future__ import annotations

from typing import Any, Literal

from ocelescope import COMPUTED_SELECTION, OCEL, OCEL_FIELD, PluginInput
from pydantic import Field


class ExampleInput(PluginInput, frozen=True):
    # Simple text input
    example_string: str = Field(title="Input string", description="A free-form input string.")

    example_string_selection: list[Literal["firststring", "secondstring"]] | None = Field(
        title="Example string choices",
        description="Select one or more example strings from the preset options.",
    )

    # Positive integer (>= 1)
    example_number: int = Field(ge=1, title="Positive number", description="A positive integer (minimum 1).")

    # OCEL-driven fields (keep your custom field constructors)
    object_type: list[str] = OCEL_FIELD(
        title="Object types",
        description="A list of object types from the OCEL.",
        field_type="object_type",
        ocel_id="ocel",
    )

    event_type: str = OCEL_FIELD(
        title="Event type",
        description="An event/activity type from the OCEL.",
        field_type="event_type",
        ocel_id="ocel",
    )

    # Computed selection whose options depend on the chosen event_type
    computed_input: list[str] = COMPUTED_SELECTION(
        provider="computed_input_function",
        title="Attribute types",
        description="Attributes available for the selected event type.",
    )

    @staticmethod
    def computed_input_function(
        input: Any,
        ocel: OCEL,
    ) -> list[str] | None:
        """
        Build the 'computed_input' options based on the selected event_type.
        Returns a list of attribute names or None if event_type is unset/unknown.
        """
        event_type = input["event_type"]
        if not event_type:
            return None

        attrs_for_type = ocel.event_attribute_summary.get(event_type)
        if not attrs_for_type:
            return None

        # Extract attribute names; ensure strings and unique ordering
        names = [getattr(a, "attribute", None) for a in attrs_for_type]
        names = [n for n in names if isinstance(n, str) and n]
        # Deduplicate while keeping order
        seen = set()
        deduped = [n for n in names if not (n in seen or seen.add(n))]

        return deduped
