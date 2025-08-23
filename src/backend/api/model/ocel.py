from dataclasses import dataclass
from typing import Optional
from ocelescope import OCEL
from ocelescope.ocel.filter import OCELFilter
from pydantic.main import BaseModel

from registry.registries.extension import OCELExtensionDescription


class OcelMetadata(BaseModel):
    id: str
    name: str
    created_at: str
    extensions: list[OCELExtensionDescription]


class UploadingOcelMetadata(BaseModel):
    task_id: str


class OcelListResponse(BaseModel):
    current_ocel_id: Optional[str]
    ocels: list[OcelMetadata]


@dataclass
class Filtered_Ocel:
    original: OCEL
    filter: Optional[OCELFilter] = None
    filtered: Optional[OCEL] = None
