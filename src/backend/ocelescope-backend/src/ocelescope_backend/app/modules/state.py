from __future__ import annotations

from collections.abc import Callable
from contextlib import AbstractContextManager
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

from ocelescope_backend.app.dependencies import ApiSession
from ocelescope_backend.app.internal.session import Session

ModuleStateT = TypeVar("ModuleStateT", bound="ModuleState")


class ModuleState(BaseModel):
    ocels: dict[str, Any] = Field(default_factory=dict)


class ModuleStateHandle(Generic[ModuleStateT]):
    def __init__(self, session: Session, state_cls: type[ModuleStateT]) -> None:
        self._session = session
        self._state_cls = state_cls

    def get(self) -> ModuleStateT:
        return self._session.module_states.get(self._state_cls)

    def update(self) -> AbstractContextManager[ModuleStateT]:
        return self._session.module_states.update(self._state_cls)


def module_state(
    state_cls: type[ModuleStateT],
) -> Callable[[Session], ModuleStateHandle[ModuleStateT]]:
    def dependency(session: ApiSession) -> ModuleStateHandle[ModuleStateT]:
        return ModuleStateHandle(session, state_cls)

    return dependency
