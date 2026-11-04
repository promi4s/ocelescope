from __future__ import annotations

from pydantic import BaseModel, Field


class EntityMappingSelection(BaseModel):
    attributes: list[str] = Field(default_factory=list)


class OcelMappingRequest(BaseModel):
    name: str
    events: EntityMappingSelection | None = None
    objects: EntityMappingSelection | None = None
    e2o: bool = False
    o2o: bool = False
