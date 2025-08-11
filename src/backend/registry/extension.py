from types import ModuleType
from typing import Literal, Optional
from ocelescope import OCELExtension


class ExtensionRegistry:
    def __init__(self):
        self._registry: dict[str, type[OCELExtension]] = {}

    def register(self, module: ModuleType):
        for var in vars(module).values():
            if isinstance(var, type) and issubclass(var, OCELExtension):
                self._registry[var.__name__] = var

    def get_loaded_extensions(
        self, file_format: Optional[Literal[".sqlite", ".xmlocel", ".jsonocel"]] = None
    ) -> list[type[OCELExtension]]:
        return [
            extension
            for extension in self._registry.values()
            if not file_format or file_format in extension.supported_extensions
        ]

    def get_labels(self):
        return {key: value.name for key, value in self._registry.items()}


extension_registry = ExtensionRegistry()
