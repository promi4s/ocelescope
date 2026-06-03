from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import ClassVar

from fastapi import FastAPI
from packaging.version import Version


@dataclass(frozen=True)
class ModuleMeta:
    key: str
    version: Version


class Module(ABC):
    meta: ClassVar[ModuleMeta]

    @classmethod
    @abstractmethod
    def create_app(cls) -> FastAPI:
        raise NotImplementedError
