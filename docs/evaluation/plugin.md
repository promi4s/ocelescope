# Plugin Evaluation

In this evaluation, you will integrate a process mining implementation to Ocelescope by creating a plugin.  
The goal is to create a new plugin using the existing Ocelescope system and its documentation.

Let’s say you have already written two Python functions:

1. A **discovery function** that discovers a *object-centric directly-follows graphs (OC-DFGs)* from an Object-Centric Event Log (OCEL).  
   It returns a list of tuples in the form  
   `(activity_1, object_type, activity_2)`,  
   where each tuple means that `activity_2` directly follows `activity_1` for the given `object_type`.  
   Start and end activities are represented with `None` as one of the activity names.

2. A **visualization function** that creates and returns a Graphviz `Digraph` instance representing the DFG, which can later be used to generate images.

??? "The Discovery and Visualization Functions"

    You don’t need to fully understand the implementation of these functions to complete this evaluation. They are provided as ready-to-use helpers that you will later integrate into your Ocelescope plugin.

    ```python title="util.py"
    from ocelescope import OCEL
    from graphviz import Digraph

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
    
    def convert_dfg_to_graphviz(dfg:list[tuple[str | None,str, str | None]]) -> Digraph:
        from graphviz import Digraph
        import itertools

        dot = Digraph("Ugly DFG")
        dot.attr(rankdir="LR")  
        
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
At the end of this evaluation, you should have a **working plugin** that looks like this:

<figure markdown="span">
  ![Final DFG discovery Plugin](../assets/evaluation-result.png){width="50%"}
  <figcaption align="center">Example of a completed OC-DFG discovery plugin in Ocelescope.</figcaption>
</figure>

For additional context or examples, you can use the [**Plugin Development Guide**](../plugins/index.md){target="_blank"} and the [**Tutorial**](../plugins/tutorial.md){target="_blank"}.  
All the information you need for this evaluation is provided here, but consulting them may help you understand the steps more clearly.

## Step 1: Setup

Let’s start by setting up the minimal Ocelescope plugin template.  
You can choose one of the following two methods to prepare your project.

### Option A — Clone the Template from GitHub

Clone the minimal plugin template directly from [:simple-github: Github (Link to the Repository)](https://github.com/Grkmr/Minimal-Ocelescope-Plugin-Template){target="_blank"}:

```bash
git clone https://github.com/Grkmr/Minimal-Ocelescope-Plugin-Template.git
cd Minimal-Ocelescope-Plugin-Template
```

### Option B — Generate a New Project with Cookiecutter

Alternatively, you can generate a new plugin project using Cookiecutter through uv:

!!! warning

    When running the Cookiecutter template, always use the default options (press **Enter** for each prompt).
    This ensures the generated project matches the structure expected in this evaluation.

```bash
uvx cookiecutter gh:rwth-pads/ocelescope --directory template
```

When you’ve completed the setup steps above, your project folder should look similar to this:

```
minimal-plugin/ <- root
├─ scripts/
│  ├─ build_plugin.py
├─ LICENSE
├─ README.md
├─ pyproject.toml
├─ requirements.txt
├─ src/
│  ├─ minimal_plugin/
│  │  ├─ __init__.py
│  │  ├─ plugin.py
```

### Install Dependencies

Navigate to the root of the template and install all dependencies using your preferred package manager.

???+ warning

    This evaluation requires **Python 3.13**. Make sure you have it installed 
    before continuing.

```sh
# With uv
uv sync

# Or with pip
pip install -r requirements.txt
```

## Step 2: Crash course in Ocelescope

### Plugin Class

An **Ocelescope plugin** is a collection of Python functions grouped inside a class that inherits from the base `Plugin` class provided by the `ocelescope` package.

Each plugin includes basic **metadata** — such as its name, version, and description — defined as class variables.  
Individual functions within the plugin are defined as **plugin methods**, which use the `@plugin_method` decorator to attach their own labels, descriptions.

<figure markdown="span">
  ![An example plugin class](../assets/plugintouimapping.png)
  <figcaption align="center">Example of an Ocelescope plugin in code and in the app.</figcaption>
</figure>

### Resources

Resources are Python classes that can be used as inputs and outputs of plugin methods.
They can represent process models, results of performance analyses, or any other structured data.

Resources produced by plugin methods are automatically saved and can be reused as inputs for other methods.
A resource is defined as a Python class that inherits from the Resource base class of Ocelescope.

Optionally, a resource can also implement a visualization function — a method that returns a instance of one of the predefined visualization types, such as Table, Graph (an interactive graph), or DotVis (a Graphviz-based visualization).

<figure markdown="span">
  ![Activity Count Resource](../assets/ActivityCountResource.png)
  <figcaption align="center">A resource used to store activity counts — on the left its Python implementation, on the right its visualization in Ocelescope.</figcaption>
</figure>

### Plugin Methods

As discussed earlier, plugin methods are functions defined inside a plugin class.
Their input parameters automatically generate a corresponding form in the Ocelescope frontend.

A plugin method can have any number of parameters of type OCEL or Resource.
In addition, it can include one PluginInput parameter, defined by inheriting from the PluginInput base class of the Ocelescope package.

The PluginInput class defines configurable parameters as fields (class attributes) of the class.
These fields can represent text inputs, algorithm variants, or numeric ranges (for example, to define thresholds or filter levels).

You can also define special OCEL-dependent fields within the same class.
These fields depend on the selected OCEL input and can represent elements such as object types, event types, or attribute names extracted directly from the log.

!!! warning "Match ocel_id with the Method Parameter"

    The ocel_id defined in each OCEL-dependent field must exactly match the name of the OCEL parameter in your plugin method.
    This ensures the field is correctly linked to the selected OCEL log.
    ```python title="Example"
    class ExampleInput(PluginInput):
        object_types: str = OCEL_FIELD(
            title="Object Type",
            description="Select which object types to include",
            field_type="object_type",
            ocel_id="ocel"  # Must match the method parameter below
        )

    class ExamplePlugin(Plugin):
        @plugin_method(label="Filter by Object Type")
        def filter_by_object_type(self, ocel: OCEL, input: ExampleInput):
            ...
    ```

<figure markdown="span">
  ![Example o](../assets/DummyDiscovery.png)
  <figcaption align="center">A resource that can be used to store activity counts</figcaption>
</figure>

## Step 2: Implement the Plugin

After setting up the project and getting familiar with how Ocelescope plugins work, we will now implement our first real plugin: a **discovery plugin for object-centric directly-follows graphs (OC-DFGs)**, as mentioned at the beginning of this evaluation.

The plugin will have the following components:

**Inputs**

- An **OCEL** log  
- A **list of object types** to include in the discovery  

**Outputs**

- An [**OC-DFG Resource**](../plugins/resource.md) containing the discovered directly-follows graph  

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
