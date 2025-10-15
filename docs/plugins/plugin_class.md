# Plugin Class

In **Ocelescope**, plugins are implemented as Python classes that inherit from the base `Plugin` class provided by the `ocelescope` package. These classes follow a standardized structure to ensure compatibility across the platform.

Each plugin class must be defined at the **top level** of the module. It cannot be nested inside another class or function. Additionally, each ZIP archive can contain **only one** plugin class.

A plugin consists of two main components:

- **Metadata**: Provides descriptive information about the plugin, such as its name, version, and description.
- **Plugin methods**: Define the functional logic of the plugin. Each method must conform to a fixed number of inputs and outputs as expected by the system.

## Metadata

Plugin metadata is defined using **class variables** within the plugin class. These variables provide descriptive information about the plugin and are required for proper registration and display within the Ocelescope system.

The metadata includes:

- **`name`**: A short, human-readable name for the plugin.
- **`description`**: A brief explanation of what the plugin does.
- **`version`**: A version string (e.g., `"1.0.0"`).

```py title="An example plugin with metadata"
from ocelescope import Plugin

class ExamplePlugin(Plugin):
    label = "Example Plugin"
    description = "An example plugin to demonstrate plugin metadata"
    version = "1.0"
    ...

```

## Methods

Plugin methods are functions that can be executed within Ocelescope. They are defined as methods of the plugin class and must be decorated with the `@plugin_method` decorator. This decorator also attaches metadata to the method, making it discoverable and usable by the system.

Once the plugin is loaded in the frontend, plugin methods become available for execution. A user interface form is automatically generated based on the method's defined inputs.

```python title="Structure of a plugin method"
from ocelescope import Plugin, plugin_method

class ExamplePlugin(Plugin):
  ...
  @plugin_method(
    label="Discover Petri net"
    description="Discover an object-centric Petri net"
  )
  def discover_petri_net(self, ...) -> ...:
    ...
    
```

### Inputs

A plugin method can accept the following types of inputs:

- **Any number of OCEL objects**  
  These are instances of the `OCEL` class provided by the `ocelescope` package.

- **Any number of Resources**  
  A detailed explanation of resources will be provided in a later section.

- **One structured input object**  
  This object allows for parameterized user input via a generated frontend form. While currently referred to as `PluginInput`, this name may change. Only **one** such input object is allowed per plugin method.

#### OCEL Inputs

OCEL inputs are passed to plugin methods as instances of the `OCEL` class provided by the `ocelescope` package. These inputs represent event logs and are selected by the user through the frontend interface.

In the UI, OCEL inputs appear as **dropdown (select) fields**, allowing users to choose from the available logs in the current session.

OCEL inputs can also be annotated with the `OCELAnnotation` to provide additional metadata, including:

- **Label**: A custom name shown in the frontend
- **Description**: A brief explanation of the input's purpose
- **Extensions**: A list of required OCEL extensions that must be present in the selected log

```py title="An example plugin with metadata"
from ocelescope import Plugin, OCEL
from typing import Annotated

class ExamplePlugin(Plugin):
  ...
  @plugin_method(
    label="Discover Petri net",
    description="Discover an object-centric Petri net"
  )
  def discover_petri_net(
      self,
      log: Annotated[OCEL, OCELAnnotation(
        label="A label for the OCEL",
        description="The log from which the Petri net is mined",
        extension=ExampleExtension
      )]
    )
```

#### Resource Inputs

Resource inputs are passed to plugin methods as instances of the `Resource` class, in a similar way to OCEL inputs. These inputs represent external data or files that the plugin may need to operate on.

In the frontend, users can select or upload resources, which are then made available to the plugin.

Resource inputs can be annotated with the `ResourceAnnotation` to provide additional metadata, including:

- **Label**: A custom name displayed in the UI
- **Description**: A short explanation of what the resource is used for

```py title="An example plugin with metadata"
from ocelescope import Plugin, PetriNet, ResourceAnnotation
from typing import Annotated

class ExamplePlugin(Plugin):
  ...
  @plugin_method(
    label="Discover Petri net",
    description="Discover an object-centric Petri net"
  )
  def check_conformance(
      self,
      log: OCEL,
      petri_net: Annotated[PetriNet,ResourceAnnotation(
                  label="A label for the Petri net",
                  description="The log on which the conformance should be checked"
                  )]
    ) -> ...:
    ...


```

#### Configuration Inputs

Structured configuration inputs are defined by creating a subclass of the `PluginInput` class from the `ocelescope` package. This class contains all parameter fields required by the plugin method that are not OCEL logs or Resources.

While the class can have any name, it **must be assigned to the variable `input`** in the plugin method. This tells Ocelescope which input schema to use when generating the frontend form.

Each plugin method may use **only one** structured input.

```python title="A example configuration input for a discovery method"

from ocelescope import Plugin, PluginInput, plugin_method, OCEL
from pydantic import Field

class DiscoverInput(PluginInput):
    noise_threshold: float = Field(
        ge=0.0,
        le=1.0,
        default=0.2,
        title="Noise Threshold",
        description="Filter out infrequent behavior (0.0–1.0)"
    )
    algorithm: str = Field(
        default="Alpha Miner",
        title="Algorithm",
        description="The discovery algorithm to use",
        enum=["Alpha Miner", "Heuristics Miner", "Inductive Miner"]
    )

class ExamplePlugin(Plugin):

    @plugin_method(
        label="Discover Petri net",
        description="Discover an object-centric Petri net from an OCEL log"
    )
    def discover_petri_net(
        self,
        log: OCEL,
        input: DiscoverInput
    ):
        ...

```

---

##### Basic Input Fields

Basic input fields allow users to enter simple configuration values such as text, numbers, selections, or booleans. These fields are defined as attributes of the input class and use Pydantic’s `Field()` function to add metadata and constraints.

The most commonly used types are:

- **Strings**: Free text or selectable options  
- **Numbers**: With optional minimum and maximum bounds  
- **Booleans**: Shown as switches or checkboxes in the UI  

---

```python title="Example: String Input"
from ocelescope import PluginInput
from pydantic import Field

class Input(PluginInput):
    algorithm_name: str = Field(
        title="Algorithm Name",
        description="Name of the analysis algorithm to use",
        default="Alpha Miner"
    )
```

---

```python title="Example: Constrained Number Input"
threshold: float = Field(
    ge=0.0,
    le=1.0,
    default=0.2,
    title="Noise Threshold",
    description="Filter out infrequent behavior (0.0–1.0)"
)
```

---

```python title="Example: Selection from Options "
method: Literal["average", "sum", "maximum", "minimum"] = Field(
    default="average",
    title="Aggregation Method",
    description="Choose how to aggregate results",
)
```

---

```python title="Example: Boolean Switch"
include_metadata: bool = Field(
    default=True,
    title="Include Metadata",
    description="Whether to include additional metadata in results"
)
```

##### OCEL-Dependent Selection Fields

Sometimes, the available options in an input field depend on the contents of an OCEL log — for example, selecting activity types, object types, or attribute names. These are called **OCEL-dependent selection fields**.

You can define them using the `OCEL_FIELD` helper from the `ocelescope` package. This creates a dynamic dropdown field populated from the specified OCEL input.

Each `OCEL_FIELD` must include:

- `field_type`: the type of OCEL data to pull (e.g., `"event_type"` or `"object_type"`)
- `ocel_id`: the name of the OCEL input parameter this field depends on

---

**Example: Selecting Object Types from an OCEL**

```python
from ocelescope import Plugin, PluginInput, plugin_method, OCEL, OCEL_FIELD
from pydantic import Field

class ObjectFilterInput(PluginInput, frozen=True):
    object_types: list[str] = OCEL_FIELD(
        title="Object Types",
        description="Select which object types to include in analysis",
        field_type="object_type",
        ocel_id="ocel"  # Must match the name of the OCEL method parameter
    )

class ExamplePlugin(Plugin):

    @plugin_method(
        label="Filter by Object Type",
        description="Filter the log based on selected object types"
    )
    def filter_log(
        self,
        ocel: OCEL,
        input: ObjectFilterInput
    ):
        ...
```

---

This allows the plugin form to stay in sync with the selected OCEL log, ensuring users can only choose valid options.

##### Dynamically Computed Fields

In some cases, the valid options for a field depend on other inputs or data passed to the plugin — including the selected OCEL log, Resources, or previously selected values. These are called **dynamically computed fields**.

To define a dynamic field, use the `COMPUTED_SELECTION` helper from the `ocelescope` package. This creates a selection field whose options are calculated by a Python function at runtime.

Each `COMPUTED_SELECTION` must specify:

- `provider`: the name of a static method (or regular method) on the input class that returns the list of options.

**Provider function accepted arguments**

| Argument  | Description                                   |
|----------|-----------------------------------------------|
| `inputs` | Dictionary of current form values             |
| OCEL logs| Selected OCEL(s) passed to the method         |
| Resources| Resource instances available to the method    |

---

**Example: Dynamic Attribute Selection Using Activities and Resource File**

```python
from ocelescope import (
    Plugin, PluginInput, plugin_method, OCEL,
    OCEL_FIELD, COMPUTED_SELECTION, Resource, ResourceAnnotation
)
from typing import Annotated

class AttributeSelectionInput(PluginInput):
    activity_types: list[str] = OCEL_FIELD(
        title="Activity Types",
        description="Select activities to analyze",
        field_type="event_type",
        ocel_id="log"
    )

    event_attributes: list[str] = COMPUTED_SELECTION(
        provider="get_available_attributes",
        title="Event Attributes",
        description="Select attributes based on selected activities and config"
    )

    @staticmethod
    def get_available_attributes(
        inputs: dict,
        log: OCEL,
        config_file: Annotated[Resource, ResourceAnnotation(
            label="Config File",
            description="External config used to filter attributes"
        )]
    ) -> list[str]:
        ...
        return attr_names

class ExamplePlugin(Plugin):

    @plugin_method(
        label="Select Event Attributes",
        description="Let users pick attributes dynamically",
    )
    def select_attributes(
        self,
        log: OCEL,
        config_file: Annotated[
            Resource,
            ResourceAnnotation(
                label="Config File",
                description="External config to influence selection"
            )
        ],
        input: AttributeSelectionInput
    ):
        ...
```

---

This makes your input fields fully dynamic and context-aware — adjusting to the current OCEL log, user selections, and even external resources.

### Outputs

Plugin method outputs in Ocelescope are defined using standard Python **type hints**.  
Ocelescope inspects these type hints to understand what the method returns and automatically makes the results available for other plugin methods in the session.

A plugin method can return:

- A single OCEL or Resource (e.g., `OCEL`, `PetriNet`)
- A list of OCELs or Resources (e.g., `list[OCEL]`, `list[PetriNet]`)
- A tuple containing any combination of the above (e.g., `tuple[OCEL, PetriNet, list[OCEL]]`)

All returned OCELs and Resources are automatically saved in the session and can be used by future plugin methods.

---

```python title="Example: Returning a Single Resource"
def discover_model(self, ...) -> PetriNet:
    ...
```

---

```python title="Example: Returning Multiple Results"
def analyze_and_export(self, ...) -> tuple[PetriNet, OCEL, list[OCEL]]:
    ...
```

---

```python title="Example: Returning a List of Resources"
def generate_variants(self, ...) -> list[PetriNet]:
    ...
```
