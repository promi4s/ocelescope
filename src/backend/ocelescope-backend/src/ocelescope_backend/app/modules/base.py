import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import ClassVar

from fastapi import FastAPI
from packaging.version import Version

from ocelescope import OCEL, BaseFilter, Resource
from ocelescope_backend.app.modules.context import ModuleContext, ModuleRegistry


@dataclass(frozen=True)
class ModuleMeta:
    key: str
    version: Version


class Module(ABC):
    meta: ClassVar[ModuleMeta]
    resources: ClassVar[list[type[Resource]]] = []
    # OCEL extensions the module knows, e.g. [QEL]. Logs of these formats are
    # labelled as such.
    extensions: ClassVar[list[type[OCEL]]] = []

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


class ModuleFilter(BaseFilter):
    OcelescopeModuleSource: ClassVar[str]
