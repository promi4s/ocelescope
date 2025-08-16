from typing import Annotated

from ocelescope import OCEL, OCELAnnotation, Plugin, plugin_method

from .inputs.example import ExampleInput
from .resources.example import ExampleResource


class {{cookiecutter.__plugin_class_name}}(Plugin):
    label = "{{cookiecutter.plugin_name}}"
    description = "{{cookiecutter.plugin_description}}"
    version = "{{cookiecutter.first_version}}"

    @plugin_method(
        label="Example Method", description="An example plugin method"
    )
    def example(
        self,
        ocel: Annotated[OCEL, OCELAnnotation(label="Event Log")],
        input: ExampleInput,
    ) -> ExampleResource:
        return ExampleResource()
