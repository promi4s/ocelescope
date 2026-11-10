from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, ClassVar

from fastapi import FastAPI
from packaging.version import Version

from ocelescope import Resource
from ocelescope_backend.app.modules.context import ModuleContext, ModuleRegistry

if TYPE_CHECKING:
    from ocelescope_backend.app.sse_manager import SSEMessage


@dataclass(frozen=True)
class ModuleMeta:
    key: str
    version: Version


class Module(ABC):
    meta: ClassVar[ModuleMeta]
    resources: ClassVar[list[type[Resource]]] = []

    def __init__(self, context: ModuleContext) -> None:
        self.context = context

    @property
    def logger(self) -> logging.Logger:
        return self.context.logger

    @property
    def registry(self) -> ModuleRegistry:
        return self.context.registry

    @abstractmethod
    def create_app(self) -> FastAPI:
        raise NotImplementedError

    def claim_upload(self, file_path: Path, file_name: str) -> list[SSEMessage] | None:
        return None
