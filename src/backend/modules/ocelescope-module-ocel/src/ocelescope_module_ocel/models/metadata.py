from typing import TYPE_CHECKING

from ocelescope_backend.app.modules.loader import known_extensions
from pydantic import BaseModel

if TYPE_CHECKING:
    from ocelescope_backend.app.internal.model.ocel import SessionOCEL


class OcelExtensionMetadata(BaseModel):
    name: str
    label: str


class OcelMetadata(BaseModel):
    id: str
    name: str
    created_at: str
    filter_applied: bool | None
    # the OCEL extensions the log is of, e.g. QEL; empty for a plain OCEL
    extensions: list[OcelExtensionMetadata]

    @classmethod
    def from_handle(cls, handle: "SessionOCEL", filter_applied: bool | None = None):
        with handle.ocel() as ocel:
            extensions = [
                OcelExtensionMetadata(name=declared.name, label=declared.label)
                for ocel_type in known_extensions()
                if (declared := ocel_type.extension) and declared.matches(ocel)
            ]

        return cls(
            id=handle.id,
            created_at=handle.created_at,
            name=handle.name,
            filter_applied=filter_applied,
            extensions=extensions,
        )
