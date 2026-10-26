from __future__ import annotations

import threading
from collections.abc import Generator
from contextlib import contextmanager
from typing import Any, TypeVar

from pydantic import BaseModel

StateT = TypeVar("StateT", bound=BaseModel)


def state_key(state_cls: type[BaseModel]) -> str:
    return f"{state_cls.__module__}.{state_cls.__qualname__}"


class StateStore:
    def __init__(self) -> None:
        self._data: dict[str, dict[str, Any]] = {}
        self._locks: dict[str, threading.RLock] = {}
        self._guard = threading.Lock()

    def _lock(self, key: str) -> threading.RLock:
        with self._guard:
            return self._locks.setdefault(key, threading.RLock())

    def get(self, state_cls: type[StateT]) -> StateT:
        data = self._data.get(state_key(state_cls))
        return state_cls.model_validate(data) if data is not None else state_cls()

    @contextmanager
    def update(self, state_cls: type[StateT]) -> Generator[StateT]:
        key = state_key(state_cls)
        with self._lock(key):
            state = self.get(state_cls)
            yield state
            self._data[key] = state.model_dump(mode="json")

    def clear(self, state_cls: type[BaseModel]) -> None:
        key = state_key(state_cls)
        with self._lock(key):
            self._data.pop(key, None)

    def drop_ocel(self, ocel_id: str) -> None:
        for key in list(self._data):
            with self._lock(key):
                data = self._data.get(key)
                if data is None or ocel_id not in data.get("ocels", {}):
                    continue
                ocels = {
                    id: ocel for id, ocel in data["ocels"].items() if id != ocel_id
                }
                self._data[key] = {**data, "ocels": ocels}
