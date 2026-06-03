from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel


class OcelEntity(BaseModel):
    id: str
    timestamp: Optional[datetime] = None
    attributes: Dict[str, Any]
    relations: Dict[str, List[str]]


class PaginatedResponse(BaseModel):
    page: int
    page_size: int
    total_pages: int
    total_items: int
    items: List[OcelEntity]


@dataclass
class EntityTableColumn:
    accessor: str
    type: Literal["attribute", "relation"]
    title: str | None = None
