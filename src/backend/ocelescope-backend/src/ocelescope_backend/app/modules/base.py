from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import ClassVar

from fastapi import FastAPI
from packaging.version import Version

from ocelescope import BaseFilter, Resource


@dataclass(frozen=True)
class ModuleMeta:
    key: str
    version: Version


class Module(ABC):
    meta: ClassVar[ModuleMeta]
    resources: ClassVar[list[type[Resource]]] = []

    @classmethod
    @abstractmethod
    def create_app(cls) -> FastAPI:
        raise NotImplementedError


class ModuleFilter(BaseFilter):
    OcelescopeModuleSource: ClassVar[str]
