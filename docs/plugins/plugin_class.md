# Plugin Class

Plugins are defined by a **single plugin class** that inherits from the `Plugin` base class provided by the Ocelescope Python package.

A plugin class contains:

- **Metadata** (e.g., label, description, version) that is displayed in the frontend’s plugin interface.
- **Runnable functions** (plugin methods) that can be invoked from within Ocelescope.

<figure markdown="span">
  ![An example plugin class](../assets/plugintouimapping.png)
  <figcaption align="center">Example of an Ocelescope plugin in code and in the app.</figcaption>
</figure>

Each plugin package must export **exactly one** plugin class via its `__init__.py`.

!!! example "An example plugin"
    ```py title="plugin.py"
    from ocelescope import OCEL, PetriNet, Plugin, plugin_method

    class DiscoveryPlugin(Plugin):
        label = "Discovery Plugin"
        description = "An Ocelescope plugin"
        version = "1.0.0"

        @plugin_method(
            label="Discover Petri Net",
            description="Discover an object-centric Petri net",
        )
        def discover_ocpn(self, ocel: OCEL) -> PetriNet: ...
    ```

    ```py title="__init__.py"
    from .plugin import DiscoveryPlugin

    __all__ = [
        "DiscoveryPlugin",
    ]
    ```

## Functions

Functions in Ocelescope are **object-centric process mining (OCPM)** operations. They consume and produce:

- **OCELs** (`OCEL`), and/or  
- **OCPM artifacts**, exposed in Ocelescope as **resources** (e.g., `PetriNet`, custom resource types).

Functions are defined as **methods on the plugin class** and must be decorated with [`@plugin_method`](../../references/plugins/#ocelescope.plugin.plugin_method).  
The **function signature** defines the interface:

- **Inputs** are derived from the method parameters (type annotations determine expected resource types).
- **Outputs** are derived from the return type annotation (including collections such as `list[Variant]`).

```py title="Some example plugin methods"
from ocelescope import OCEL, PetriNet, Plugin, plugin_method

from .custom_resources import ConformanceResult, Variant


class DiscoveryPlugin(Plugin):
    ...

    @plugin_method(
        label="Discover Petri Net",
        description="Discover an object-centric Petri net",
    )
    def discover_ocpn(self, ocel: OCEL) -> PetriNet: ...

    @plugin_method(
        label="Discover Variants",
        description="Discover variants",
    )
    def discover_olpm(self, ocel: OCEL) -> list[Variant]: ...

    @plugin_method(
        label="Alignment-based Conformance",
        description="Compute alignment-based conformance",
    )
    def conformance_alignment(
        self,
        petri_net: PetriNet,
        variants: list[Variant],
    ) -> ConformanceResult: ...
```

The function definitions (decorator metadata, parameter types, and return types) are used to **automatically generate an input form** in the frontend.

!!! tip "Metadata"
    In addition to the `@plugin_method` metadata, you can annotate input parameters with
    [`ResourceAnnotation`](../../references/plugins/#ocelescope.plugin.ResourceAnnotation) and [`OCELAnnotation`](../../references/plugins/#ocelescope.plugin.OCELAnnotation) from the Ocelescope package to provide extra context—such as a **human-readable title** or **description**—for the function and its inputs.

    <figure markdown="span">
      ![An example plugin usage of adding metadata](../assets/functionMetadata.png)
    </figure>

### Configuration Inputs

In addition to `Resource` and `OCEL` parameters, a plugin method can define **one extra configuration parameter** of type `PluginInput`.

Use a `PluginInput` when your method needs **user-provided settings**—for example:

- a **noise threshold** between `0` and `1`
- selecting a **leading object type** for computing process executions
- toggles, lists, or other algorithm parameters

Configuration settings are grouped into a **single class** that inherits from `PluginInput` (from the Ocelescope Python package).  
Each setting is defined as a **class field** and can be a `str`, `bool`, number, `list`, or even another Pydantic model.

To make inputs easier to use in the UI, you can add:

- **metadata** (title, description, etc.), and
- **constraints** (min/max values, patterns, list length, …)

You do this with Pydantic’s [`Field`](https://docs.pydantic.dev/latest/concepts/fields/) helper.

**Important:** Each plugin method can have **exactly one** `PluginInput` parameter, and it **must be named `input`**.

<figure markdown="span">
  ![An example plugin input and its resulting form](../assets/ExamplePluginInput.png)
</figure>

??? example "An Example PluginInput"

    ```py
    from typing import Annotated, Literal

    from ocelescope import OCEL, OCELAnnotation, Plugin, PluginInput, plugin_method
    from pydantic import BaseModel, ConfigDict, Field

    class SubInput(BaseModel):
        """Description of the SubInput."""

        model_config = ConfigDict(title="A SubInput")

        subfield_a: str
        subfield_b: int

    class Input(PluginInput):
        sub_input_field: SubInput

        number_field: float = Field(
            default=0.1,
            ge=0,
            le=1,
            title="A number field",
        )

        string_field: str = Field(
            default="id_1",
            pattern="id_*",
            max_digits=10,
            description="A string that has to start with id_",
        )

        literal_field: Literal["A", "B", "C"]

        list_field: list[int] = Field(max_length=5)

    class MinimalPlugin(Plugin):
        label = "Minimal Plugin"
        description = "An Ocelescope plugin"
        version = "0.1.0"

        @plugin_method(label="Example Method", description="An example plugin method")
        def example(
            self,
            ocel: Annotated[OCEL, OCELAnnotation(label="Event Log")],
            input: Input,  # must be named `input`
        ) -> OCEL:
            ...
    ```

#### OCEL Fields

OCEL fields let you populate configuration inputs with values taken directly from the selected OCEL log—for example:

- available **object types**
- available **event types / activities**
- **event IDs** and **object IDs**
- available **event/object attribute names**

You define these fields with [`OCEL_FIELD`](../../references/plugins/#ocelescope.plugin.OCEL_FIELD). It works similarly to Pydantic’s `Field`, but instead of only validating user input, it **connects the input to the OCEL** so the UI can offer dropdowns/autocomplete based on the log.

**Important:** The `ocel_id` must match the name of the `OCEL` parameter in your plugin method (usually `ocel`). Otherwise, the field cannot be linked to the selected log.

<figure markdown="span">
  ![An example for using OCEL Field](../assets/OCEL_FIELD.png)
</figure>

??? example "Using `OCEL_FIELD`"

    ```python
    from typing import Annotated

    from ocelescope import OCEL, OCEL_FIELD, OCELAnnotation, Plugin, PluginInput, plugin_method

    class Input(PluginInput):
        object_type_field: str = OCEL_FIELD(field_type="object_type", ocel_id="ocel")
        object_type_list_field: list[str] = OCEL_FIELD(field_type="object_type", ocel_id="ocel")

        event_type_field: str = OCEL_FIELD(field_type="event_type", ocel_id="ocel")

        event_id_field: str = OCEL_FIELD(field_type="event_id", ocel_id="ocel")
        object_id_field: str = OCEL_FIELD(field_type="object_id", ocel_id="ocel")

        object_attribute_field: str = OCEL_FIELD(field_type="object_attribute", ocel_id="ocel")
        event_attribute_field: str = OCEL_FIELD(field_type="event_attribute", ocel_id="ocel")

    class MinimalPlugin(Plugin):
        label = "Minimal Plugin"
        description = "An Ocelescope plugin"
        version = "0.1.0"

        @plugin_method(label="Example Method", description="An example plugin method")
        def example(
            self,
            ocel: Annotated[OCEL, OCELAnnotation(label="Event Log")],
            input: Input,  # must be named `input`
        ) -> OCEL:
            ...
    ```

#### Computed Inputs

Computed inputs are fields whose available values are generated dynamically from the **current state of the input form**.

They are useful when the options depend on what the user has already entered—for example, generating a list of values based on a prefix, or filtering choices based on earlier selections.

Computed inputs are defined with [`COMPUTED_SELECTION`](../../references/plugins/#ocelescope.plugin.COMPUTED_SELECTION). You provide the name of a **provider function** (as a string). Ocelescope calls that function whenever the user changes the form, and uses the returned list as the selectable values.

<figure markdown="span">
  ![An example for using a Computed Field](../assets/Computed_Field.png)
</figure>

??? example "Using a `COMPUTED_SELECTION`"

    ```python
    from typing import Any

    from ocelescope import COMPUTED_SELECTION, OCEL, Plugin, PluginInput, plugin_method

    class Input(PluginInput):
        prefix: str

        prefixed_object_type: str = COMPUTED_SELECTION(provider="computed_input")

        @staticmethod
        def computed_input(ocel: OCEL, input: dict[str, Any]):
            return [f"{input['prefix']}_{object_type}" for object_type in ocel.objects.types]

    class MinimalPlugin(Plugin):
        label = "Minimal Plugin"
        description = "An Ocelescope plugin"
        version = "0.1.0"

        @plugin_method(label="Example Method", description="An example plugin method")
        def example(self, ocel: OCEL, input: Input) -> OCEL:
            ...
    ```
