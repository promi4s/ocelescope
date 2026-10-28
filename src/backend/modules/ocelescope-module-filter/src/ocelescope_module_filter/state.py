from typing import Annotated

from fastapi import Depends
from ocelescope_backend.app.modules import (
    ModuleState,
    ModuleStateHandle,
    module_state,
)
from pydantic import BaseModel, Field

from ocelescope_module_filter.filters import NativeFilter


class FilterState(BaseModel):
    pipeline: list[NativeFilter] = Field(default_factory=list)
    view_id: str | None = None


class FilterModuleState(ModuleState):
    ocels: dict[str, FilterState] = Field(default_factory=dict)


ApiFilterState = Annotated[
    ModuleStateHandle[FilterModuleState], Depends(module_state(FilterModuleState))
]
