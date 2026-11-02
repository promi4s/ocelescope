from pydantic import DirectoryPath, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class PluginModuleConfig(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PLUGIN_DIR: DirectoryPath | None = Field(
        default=None,
        description="Path to the directory, where plugins are stored",
    )


config = PluginModuleConfig()
