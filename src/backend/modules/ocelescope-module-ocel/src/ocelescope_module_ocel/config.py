from functools import cache
from typing import Annotated, TypeAlias

from fastapi import Depends
from pydantic import DirectoryPath, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from ocelescope_module_ocel.models.default_ocel import DefaultOCELConfig

"""
This file contains a Config class defining all environment parameters, including types, default values and descriptions.
.env.example (and the structure of .env) should be generated using the `export_settings_as_dotenv` util function.
"""


class OCELModuleConfig(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATA_DIR: DirectoryPath | None = Field(
        default=None,
    )


config = OCELModuleConfig()


@cache
def get_default_ocel_config() -> DefaultOCELConfig | None:
    """Load the default OCEL config once; `None` if no data dir or config file exists."""
    if config.DATA_DIR is None:
        return None
    if not (config.DATA_DIR / DefaultOCELConfig.CONFIG_FILE_NAME).is_file():
        return None
    return DefaultOCELConfig.from_path(config.DATA_DIR)


DefaultOCELs: TypeAlias = Annotated[
    DefaultOCELConfig | None, Depends(get_default_ocel_config)
]
