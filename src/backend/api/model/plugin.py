from pydantic.main import BaseModel
from ocelescope.plugin import PluginMeta, PluginMethod


class PluginApi(BaseModel):
    id: str
    meta: PluginMeta
    methods: list[PluginMethod]
