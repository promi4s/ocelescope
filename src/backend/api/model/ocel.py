from dataclasses import dataclass
from typing import Optional
from ocelescope import OCEL
from ocelescope.ocel.filter import OCELFilter
from pydantic.main import BaseModel


class OcelMetadata(BaseModel):
    id: str
    name: str
    created_at: str
    extensions: list[str]


class UploadingOcelMetadata(BaseModel):
    name: str
    task_id: str
    uploaded_at: str


class OcelListResponse(BaseModel):
    current_ocel_id: Optional[str]
    ocels: list[OcelMetadata]
    uploading_ocels: list[UploadingOcelMetadata]


@dataclass
class Filtered_Ocel:
    original: OCEL
    filter: Optional[OCELFilter] = None
    filtered: Optional[OCEL] = None
