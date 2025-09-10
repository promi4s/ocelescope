# Plugin Evaluation

In this evaluation, we simulate the development of a new plugin within Ocelescope. As an example, we consider the case where a researcher wants to implement a novel variant of the directly-follows graph. The following tasks describe the procedure used to evaluate the effort of writing plugins.

## Step 1: Setup

Clone or download the [minimal plugin Ocelescope template](https://github.com/Grkmr/Minimal-Ocelescope-Plugin-Template).  
Install the dependencies using your method of choice (for example, `uv sync` or `pip install -r requirements.txt`).
Navigate to the file `src/plugin/plugin.py`, which contains the initial plugin skeleton.  

```python title="Minimal Plugin Template"
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

    @plugin_method(label="Minimal Method", description="An minimal plugin method")
    def minimal_method(
        self,
        ocel: Annotated[OCEL, OCELAnnotation(label="Event Log")],
        input: Input,
    ) -> MinimalResource:
        return MinimalResource()
```

## Step 2: Implement the Plugin

The goal of this step is to implement a new plugin that discovers an object-centric directly-follows graph.  
The plugin should take an OCEL as input together with a list of object types, compute the directly-follows graph using these parameters, and return the result as a custom resource.  
This resource will store the graph as a list of edge tuples and provide a visualization based on Graphviz.  
The following subtasks describe the individual steps required to achieve this.  

### Step 2.1: Rename the Plugin Class

Rename the class `MinimalPlugin` to a meaningful name such as `DiscoverDFG`.  
Update the label and description accordingly.  
Adapt the import in `src/minimalplugin/__init__.py` to reflect the new class name.  

### Step 2.2: Rename the Plugin Method

Rename the method `minimal_method` to a descriptive name such as `discover`.  
Update the metadata fields `label` and `description`.  

### Step 2.3: Extend the Input Class

Keep the OCEL input that is already defined.  
Add an additional field for a list of object types into the input class using a ```OCEL_FIELD```.  

```
class Input(PluginInput, frozen=True):
    pass
```

Consult the [Plugin Development Guide](../plugins/plugin_class.md#ocel-dependent-selection-fields) if needed.  

### Step 2.4: Create a Custom Resource

Rename the class `MinimalResource` to `DFG`.  
Add a field `edges` to represent the directly-follows graph as a list of edge tuples of the type ```list[tuple[str | None , str, str | None]]```.  
Update the label and description fields to reflect the purpose of this resource.  

```
class MinimalResource(Resource):
    def visualize(self) -> None:
        pass
```

Adjust also the type hint in the plugin method to return the new resource.  
See the [Plugin Development Guide](../plugins/resource.md) for details.  

### Step 2.5: Add a Visualization

Extend the `DFG` resource with a `visualize` method.  
Implement a conversion function that turns the directly-follows graph into a Graphviz representation.  
Use Ocelescope’s Graphviz integration to render the visualization inside the resource.  
You can use the following conversion function

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
            dot.edge(inner_sources[x], tgt, color=color, penwidth="2")
        elif src is not None and tgt is None:
            dot.edge(src, inner_sinks[x], color=color, penwidth="2")
    
    return dot
```

### Step 2.6: Integrate the Implementation

Modify the plugin method so that it calls the given discovery function for the directly-follows graph.  

```python
def discover_dfg(ocel: OCEL, used_object_types: list[str]) -> list[tuple[str | None , str, str | None]]:
    import pm4py

    ocel_filtered = pm4py.filter_ocel_object_types(ocel.ocel, ["customers", "employees"], positive=True)
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

Return an instance of the `DFG` resource with the discovered edges assigned to its field.  

### Step 3: Build your plugin

Use the script in ```script/build_plugin.py``` called from the root of the project to build your plugin. The build plugin can be then found in dist/minimal_plugin.zip. Try to run it in Ocelescope. You can now return to the evaluation form.
