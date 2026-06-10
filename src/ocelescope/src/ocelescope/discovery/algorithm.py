"""Field helpers for `@discovery_method` arguments.

These return `pydantic.Field` objects intended for use inside `Annotated[...]`
on a discovery function's parameters. They attach metadata that the backend
turns into JSON schema entries for the frontend form.

For generic fields without extra UI metadata, use `pydantic.Field` directly.
"""

from typing import Any

from pydantic import Field


def percentage_field(
    *,
    title: str,
    description: str | None = None,
) -> Any:
    return Field(
        ge=0,
        le=100,
        title=title,
        description=description,
    )


def select_field(
    *,
    title: str,
    description: str | None = None,
    options: dict[str, str],
) -> Any:
    return Field(
        title=title,
        description=description,
        json_schema_extra={"enumNames": list(options.values())},
    )
