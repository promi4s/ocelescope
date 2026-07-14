from typing import TYPE_CHECKING

from pydantic import BaseModel

from ocelescope_backend.app.internal.registry import registry_manager
from ocelescope_backend.app.internal.registry.extension import OCELExtensionDescription

if TYPE_CHECKING:
    from ocelescope_backend.app.internal.model.ocel import SessionOCEL


class OcelMetadata(BaseModel):
    id: str
    name: str
    created_at: str
    extensions: list[OCELExtensionDescription]
    filter_applied: bool | None

    @classmethod
    def from_handle(cls, handle: "SessionOCEL", filter_applied: bool | None = None):
        # Extensions live only as in-memory instances on the handle (they are not
        # persisted with the DuckDB store); metadata is read off the handle
        # without materializing the OCEL.
        descriptions = registry_manager.get_extension_descriptions()
        return cls(
            id=handle.id,
            created_at=handle.created_at,
            name=handle.name,
            extensions=[
                descriptions[extension.__class__.__name__]
                for extension in handle.extensions
                if extension.__class__.__name__ in descriptions
            ],
            filter_applied=filter_applied,
        )
