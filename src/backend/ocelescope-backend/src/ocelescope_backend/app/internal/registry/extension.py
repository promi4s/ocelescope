from collections import defaultdict

from ocelescope import OCELExtension


class ExtensionRegistry:
    def __init__(self) -> None:
        self.extensions: defaultdict[str, dict[str, type[OCELExtension]]] = defaultdict(
            dict
        )

    def register_extension(
        self, source_id: str, extension_class: type[OCELExtension]
    ) -> None:
        if not extension_class.id or not extension_class.label:
            raise ValueError("OCEL extensions need a nonempty id and label")

        # One id names one extension. The same class may be registered by several
        # sources; a different class under an id already taken is a conflict.
        entries = self.extensions.get(extension_class.id, {})
        if any(existing is not extension_class for existing in entries.values()):
            raise ValueError(f"Duplicate OCEL extension id: {extension_class.id}")

        self.extensions[extension_class.id][source_id] = extension_class

    def get_extensions(self) -> list[type[OCELExtension]]:
        """Every registered extension, once each."""
        return [next(iter(entries.values())) for entries in self.extensions.values()]

    def unload_module(self, source_id: str) -> None:
        for extension_id, entry in list(self.extensions.items()):
            entry.pop(source_id, None)

            if not entry:
                del self.extensions[extension_id]
