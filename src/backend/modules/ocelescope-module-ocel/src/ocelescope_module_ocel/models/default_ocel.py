from pathlib import Path
from typing import ClassVar, Self

import orjson
from pydantic import BaseModel, DirectoryPath, Field


class DefaultOCEL(BaseModel):
    key: str
    name: str
    version: str
    file: str
    url: str | None = None


class DefaultOCELConfig(BaseModel):
    CONFIG_FILE_NAME: ClassVar[str] = "event_logs.json"

    root: DirectoryPath = Field(exclude=True)
    base_path: Path
    event_logs: list[DefaultOCEL] = Field(default_factory=list)

    @property
    def event_log_directory(self) -> Path:
        return self.root / self.base_path

    @classmethod
    def from_path(cls, path: Path) -> Self:
        config_file_path = path / cls.CONFIG_FILE_NAME
        return cls.model_validate(
            {**orjson.loads(config_file_path.read_bytes()), "root": path}
        )

    def get_event_log(self, key: str, version: str | None = None) -> DefaultOCEL | None:
        return next(
            (
                log
                for log in self.event_logs
                if log.key == key and (not version or log.version == version)
            ),
            None,
        )
