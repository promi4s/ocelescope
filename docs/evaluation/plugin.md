# Plugin Evaluation

In this evaluation, we implement a new plugin for Ocelescope that discovers object-centric directly-follows graphs. This serves as a test case to assess how easy it is to develop and integrate plugins using the provided system and documentation.

## Step 1: Setup

To begin evaluating the Ocelescope plugin system, start by setting up your development environment using one of the following methods.

### Clone or Scaffold the Minimal Plugin Template

You can either clone the minimal template repository or generate a new project using the cookiecutter template.

```sh
# Option A: Clone the minimal plugin template
git clone git@github.com:Grkmr/Minimal-Ocelescope-Plugin-Template.git

# Option B: Use `uvx` and cookiecutter to generate a new plugin project
uvx cookiecutter gh:rwth-pads/ocelescope --directory template
```

### Install Dependencies

Install all required dependencies using your preferred method:

```sh
# With uv
uv sync

# Or with pip
pip install -r requirements.txt
```

### Locate the Plugin Entry Point

Navigate to the following file, which contains the initial plugin skeleton:

```
src/minimal_plugin/plugin.py
```

Below is the content of the minimal plugin template:

```python title="src/plugin/plugin.py"
from typing import Annotated
from ocelescope import OCEL, OCELAnnotation, Plugin, PluginInput, Resource, plugin_method

class MinimalResource(Resource):
    def visualize(self) -> None:
        pass

class Input(PluginInput, frozen=True):
    pass

class MinimalPlugin(Plugin):
    label = "MinimalPlugin"
    description = "A minimal plugin template"
    version = "0.1.0"

    @plugin_method(label="Minimal Method", description="A minimal plugin method")
    def minimal_method(
        self,
        ocel: Annotated[OCEL, OCELAnnotation(label="Event Log")],
        input: Input,
    ) -> MinimalResource:
        return MinimalResource()
```

## Step 2: Implement the Plugin

The goal of this step is to implement a new plugin that discovers an **object-centric directly-follows graph (OC-DFG)**.

The plugin should:

- Take an **OCEL** as input.
- Accept a **list of object types** as parameters.
- Compute the OC-DFG using these parameters.
- Return the result as a [**Resource**](../plugins/resource.md).

### Step 2.1: Rename the Plugin Class

Rename the class `MinimalPlugin` to a meaningful name such as `DiscoverDFG`.  
Update the label and description accordingly.  
Adapt the import in `src/minimal_plugin/__init__.py` to reflect the new class name.  

### Step 2.2: Rename the Plugin Method

Rename the method `example` to a descriptive name such as `discover`.  
Update the metadata fields `label` and `description`.  

### Step 2.3: Extend the Input Class

Extend the Input class by adding a new field that captures a list of object types.
Use the ``OCEL_FIELD`` helper to define this field and link it to the OCEL input.

```
class Input(PluginInput, frozen=True):
    pass
```

Refer to the [Plugin Development](../plugins/plugin_class.md#ocel-dependent-selection-fields) Guide for details on defining OCEL-dependent selection fields.

!!! warning
    Make sure the `ocel_id` in `OCEL_FIELD` matches the `ocel` parameter of the function.

### Step 2.4: Create a Custom Resource

The discovery method returns the object-centric directly-follows graph (OC-DFG) as a list of triplets:

```
(event_1, object_type, event_2)
```

These represent direct-follow relationships between events for a given object type. Start and end edges are represented using ``None``:

- Start edges: ``(None, object_type, event)``
- End edges: ``(event, object_type, None)``

To integrate this into the plugin system, define a custom resource to hold this data.

- Rename the class MinimalResource to DFG.
- Update the label and description to reflect that the resource represents an object-centric directly-follows graph.

  ```python
  class MinimalResource(Resource):
    label = "Minimal Resource"
    description = "A minimal resource"

    def visualize(self) -> None:
        pass
  ```

- Add a field edges with the following type:

  ```python
    list[tuple[str | None, str, str | None]]
  ```

- Update the return type of the plugin method so that it returns the new DFG resource.

Refer to the [Plugin Development Guide](../plugins/resource.md) or the [tutorial](../plugins/tutorial.md) for more details on defining custom resources

### Step 2.5: Add a Visualization

You already implemented a helper function (`convert_dfg_to_graphviz`) that creates a **Graphviz Digraph** representation of your object-centric directly-follows graph (OC-DFG).

??? tip "Visualization Method"

    ```python
    def convert_dfg_to_graphviz(dfg:list[tuple[str | None,str, str | None]]):
      from graphviz import Digraph
      import itertools

      dot = Digraph("Ugly DFG")
      dot.attr(rankdir="LR")  # Spread things out
      
      outer_nodes = set()
      inner_sources = {}
      inner_sinks = {}
      edges_seen = set()
      types = set()
      
      for src, x, tgt in dfg:
          if src is not None:
              outer_nodes.add(src)
          if tgt is not None:
              outer_nodes.add(tgt)
          if x is not None:
              types.add(x)
              inner_sources[x] = f"source_{x}"
              inner_sinks[x] = f"sink_{x}"
          edges_seen.add((src, x, tgt))
      
      # A palette of colors
      palette = [
          "red", "blue", "green", "orange", "purple",
          "brown", "gold", "pink", "cyan", "magenta"
      ]
      color_map = {x: c for x, c in zip(sorted(types), itertools.cycle(palette))}
      
      # Outer nodes: neutral color
      for n in outer_nodes:
          dot.node(n, shape="rectangle", style="filled", fillcolor="lightgray")
      
      # Sources and sinks: colored small circles, with xlabel underneath
      for x in types:
          color = color_map[x]
          dot.node(
              inner_sources[x],
              shape="circle",
              style="filled",
              fillcolor=color,
              width="1",
              height="1",
              fixedsize="true",
              label="",
              xlabel=x
          )
          dot.node(
              inner_sinks[x],
              shape="circle",
              style="filled",
              fillcolor=color,
              width="1",
              height="1",
              label="",
              fixedsize="true",
              xlabel=x
          )
      
      # Rank groups
      with dot.subgraph() as s:
          s.attr(rank="same")
          for n in inner_sources.values():
              s.node(n)
      
      with dot.subgraph() as s:
          s.attr(rank="same")
          for n in inner_sinks.values():
              s.node(n)
      
      # Add edges with thicker lines
      for src, x, tgt in edges_seen:
          if x is None:
              continue
          color = color_map[x]
          if src is not None and tgt is not None:
              dot.edge(src, tgt, color=color, penwidth="2")
          elif src is None and tgt is not None:
              dot.edge(tgt, inner_sinks[x], color=color, penwidth="2")
          elif src is not None and tgt is None:
              dot.edge(src, inner_sources[x], color=color, penwidth="2")
      
      return dot
    ```

Now, the goal is to **reuse** this function inside your Ocelescope resource so the OC-DFG can be displayed directly in the UI.

What to Do (Inside the `visualize` method):

1. **Generate the Digraph**
   Call `convert_dfg_to_graphviz` with your DFG data to produce a `graphviz.Digraph`.

2. **Convert to DotVis**
   Wrap the resulting `Digraph` in a `DotVis` using `DotVis.from_graphviz(...)`. See [docs](../plugins/resource.md#dot).

   - Choose an appropriate Graphviz layout engine (e.g., `"dot"` ).
3. **Return the visualization**
  Update visualize to return the `DotVis` object, and change its signature to `-> DotVis`.

### Step 2.6: Integrate the Implementation

Modify your plugin method so that it calls the provided discovery function to compute the object-centric directly-follows graph based on the selected object types.

Then, return an instance of the DFG resource, assigning the discovered edges to its edges field.

??? tip "Discover Function"
    ```python
    def discover_dfg(ocel: OCEL, used_object_types: list[str]) -> list[tuple[str | None , str, str | None]]:
        import pm4py

        ocel_filtered = pm4py.filter_ocel_object_types(ocel.ocel, used_object_types, positive=True)
        ocdfg = pm4py.discover_ocdfg(ocel_filtered)
        edges :list[tuple[str | None , str, str | None]]= []
        for object_type, raw_edges in ocdfg["edges"]["event_couples"].items():
            edges = edges + ([(source, object_type, target) for source, target in raw_edges])

            edges += [
                (activity, object_type, None)
                for object_type, activities in ocdfg["start_activities"]["events"].items()
                for activity in activities.keys()
            ]

            edges += [
                (None, object_type, activity)
                for object_type, activities in ocdfg["end_activities"]["events"].items()
                for activity in activities.keys()
            ]
        return edges
    ```

### Step 3: Build your plugin

Use the provided build script to package your plugin so it can be used in Ocelescope.

From the root of your plugin project, run:

```sh
python script/build_plugin.py
```

This will generate a plugin as a `.zip` in the ``dist/`` directory.

Upload this ZIP file in the Ocelescope interface to test your plugin.

You can return to the evaluation form to complete the assessment.
