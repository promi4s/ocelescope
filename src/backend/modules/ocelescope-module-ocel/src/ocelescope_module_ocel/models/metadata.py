from typing import TYPE_CHECKING

from pydantic import BaseModel

if TYPE_CHECKING:
    from ocelescope_backend.app.internal.model.ocel import SessionOCEL
    from ocelescope_backend.app.internal.model.view import SessionView


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


class ViewMetadata(BaseModel):
    id: str
    name: str
    ocel_id: str
    source: str | None
    active: bool
    created_at: str

    @classmethod
    def from_view(cls, view: "SessionView", active: bool = False):
        return cls(
            id=view.id,
            name=view.name,
            ocel_id=view.ocel_id,
            source=view.source,
            active=active,
            created_at=view.created_at,
        )
