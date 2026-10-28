from typing import TYPE_CHECKING

from pydantic import BaseModel

if TYPE_CHECKING:
    from ocelescope_backend.app.internal.model.ocel import SessionOCEL


class OcelMetadata(BaseModel):
    id: str
    name: str
    created_at: str
    filter_applied: bool | None

    @classmethod
    def from_handle(cls, handle: "SessionOCEL", filter_applied: bool | None = None):
        return cls(
            id=handle.id,
            created_at=handle.created_at,
            name=handle.name,
            filter_applied=filter_applied,
        )
