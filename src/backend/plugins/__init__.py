from plugins.registry import PluginRegistry, plugin_method
from .base import BasePlugin


plugin_registry = PluginRegistry()

register_plugin = plugin_registry.register

__all__ = ["BasePlugin", "register_plugin", "plugin_method"]
