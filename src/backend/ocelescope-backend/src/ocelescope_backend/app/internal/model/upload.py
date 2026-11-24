from __future__ import annotations

from typing import Literal

from pydantic import BaseModel
from typing_extensions import TypeAliasType


class XesUploadExtras(BaseModel):
    kind: Literal["xes"] = "xes"
    object_type: str | None = None
    type_attribute: str | None = None


UploadExtras = TypeAliasType("UploadExtras", XesUploadExtras)
