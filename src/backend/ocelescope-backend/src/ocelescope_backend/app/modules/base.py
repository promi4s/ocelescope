from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import ClassVar

from fastapi import FastAPI


@dataclass(frozen=True)
class ModuleMeta:
    key: str
    label: str
    version: str
    mount_path: str


class Module(ABC):
    meta: ClassVar[ModuleMeta]

    @classmethod
    @abstractmethod
    def create_app(cls) -> FastAPI:
        raise NotImplementedError
