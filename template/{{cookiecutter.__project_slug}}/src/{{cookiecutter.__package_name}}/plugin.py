from typing import Annotated

from ocelescope import OCEL, OCELAnnotation,{% if cookiecutter.include_example_extension == "yes" %} OCELExtension,{% endif %} Plugin, PluginInput, Resource, plugin_method

{% if cookiecutter.include_example_extension == "yes" %}

class MinimalExtension(
    OCELExtension,
):
    name = "Minimal Extension"
    description = "A minimal extension"
    version = "1.0"
    supported_extensions = []

    @staticmethod
    def has_extension(path):
        return False

    @classmethod
    def import_extension(cls, ocel, path):
        return cls()

    def export_extension(self, path):
        return
{% endif %}

class MinimalResource(Resource):
    label = "Minimal Resource"
    description = "A minimal resource"

    def visualize(self):
        pass


class Input(PluginInput):
    pass

class {{cookiecutter.__plugin_class_name}}(Plugin):
    label = "{{cookiecutter.plugin_name}}"
    description = "{{cookiecutter.plugin_description}}"
    version = "{{cookiecutter.first_version}}"

    @plugin_method(label="Example Method", description="An example plugin method")
    def example(
        self,
        ocel: Annotated[OCEL, OCELAnnotation(label="Event Log")],
        input: Input,
    ) -> MinimalResource:
        return MinimalResource()
