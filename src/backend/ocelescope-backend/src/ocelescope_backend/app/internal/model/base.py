from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel, computed_field

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    response: T
    page: int
    page_size: int
    total_items: int

    @computed_field
    @property
    def total_pages(self) -> int:
        return self.total_items // self.page_size
