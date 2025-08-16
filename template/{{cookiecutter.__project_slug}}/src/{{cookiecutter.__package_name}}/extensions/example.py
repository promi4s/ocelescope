from ocelescope import OCELExtension


class ExampleExtension(OCELExtension):
    name = "Example Extension"
    description = "An example for a OCEL extension"
    version = "1.0"
    supported_extensions = []

    @staticmethod
    def has_extension(path) -> bool:
        return False

    @classmethod
    def import_extension(cls, ocel, path):
        return cls()

    def export_extension(self, path):
        raise NotImplementedError("Export not yet implemented.")
