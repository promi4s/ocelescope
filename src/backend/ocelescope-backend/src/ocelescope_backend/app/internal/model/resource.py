from datetime import UTC, datetime
from pathlib import Path

from pydantic import BaseModel, Field


class ResourceInfo(BaseModel):
    """Ocelescope-owned metadata of a resource held by a session."""

    name: str
    created_at: str = Field(default_factory=lambda: datetime.now(tz=UTC).isoformat())
    source_id: str | None = None


class ResourceHeader(ResourceInfo):
    schema_hash: str


class ResourceStore(ResourceHeader):
    """A resource dumped into its own file at ``path``, e.g. by a session."""

    path: Path

    def delete(self) -> None:
        self.path.unlink(missing_ok=True)


class ResourceApi(ResourceHeader):
    id: str
    resource_type_label: str
