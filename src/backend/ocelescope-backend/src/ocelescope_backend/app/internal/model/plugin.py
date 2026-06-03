from pydantic import BaseModel
from ocelescope import PluginMeta, PluginMethod


class PluginApi(BaseModel):
    id: str
    meta: PluginMeta
    methods: list[PluginMethod]
