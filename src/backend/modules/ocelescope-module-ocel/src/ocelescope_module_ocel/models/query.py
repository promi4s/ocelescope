from typing import Any

from pydantic import BaseModel, Field

#: More rows than a chart can draw or a browser should hold. Queries that reach
#: it are answered truncated rather than refused, so a chart still renders.
DEFAULT_MAX_ROWS = 5_000


class SqlQueryRequest(BaseModel):
    """A DuckDB query and the values bound to its ``?`` placeholders."""

    sql: str
    parameters: list[Any] = Field(default_factory=list)
    max_rows: int = Field(default=DEFAULT_MAX_ROWS, ge=1, le=100_000)


class SqlColumn(BaseModel):
    name: str
    type: str
    """The DuckDB type, e.g. ``BIGINT`` or ``TIMESTAMP``. Clients read it to
    decide what is a measure, a category or a point in time."""


class SqlQueryResult(BaseModel):
    """Tidy rows plus the schema DuckDB reported for them."""

    columns: list[SqlColumn]
    rows: list[dict[str, Any]]
    truncated: bool = False
    """The query had more rows than ``max_rows``; the extra ones are not here."""
