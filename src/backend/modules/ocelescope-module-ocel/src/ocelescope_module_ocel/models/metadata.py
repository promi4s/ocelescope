from typing import TYPE_CHECKING

from ocelescope_backend.app.internal.registry import registry_manager
from pydantic import BaseModel, Field

from ocelescope import OCELExtension

if TYPE_CHECKING:
    from ocelescope_backend.app.internal.model.ocel import SessionOCEL


class OcelExtensionMetadata(BaseModel):
    id: str
    label: str


def _recognized_extensions(handle: "SessionOCEL") -> list[type[OCELExtension]]:
    """The registered extensions the handle's active view is a log of.

    Looked at once per view and kept on the handle; changing the filters clears it.
    """
    extensions = registry_manager.extension_registry.get_extensions()
    if not extensions:
        return []

    if handle.recognized_extensions is None:
        recognized = []
        with handle.ocel() as ocel:
            for extension in extensions:
                if extension.is_valid(ocel):
                    recognized.append(extension)

        handle.recognized_extensions = recognized

    return handle.recognized_extensions


class OcelMetadata(BaseModel):
    id: str
    name: str
    created_at: str
    filter_applied: bool | None
    extensions: list[OcelExtensionMetadata] = Field(default_factory=list)

    @classmethod
    def from_handle(cls, handle: "SessionOCEL", filter_applied: bool | None = None):
        return cls(
            id=handle.id,
            created_at=handle.created_at,
            name=handle.name,
            filter_applied=filter_applied,
            extensions=[
                OcelExtensionMetadata(id=extension.id, label=extension.label)
                for extension in _recognized_extensions(handle)
            ],
        )
