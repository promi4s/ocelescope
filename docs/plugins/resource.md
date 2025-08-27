# Resources

Resources are the primary mechanism for defining **inputs** and **outputs** in Ocelescope plugins.

A resource can represent almost anything — from process models to tabular datasets.  
Resources are automatically uploadable and downloadable, making them easy to share across plugin methods and even between different plugins.

## Defining a Resource

To create a custom resource:

- Define a Python class that inherits from `Resource` (provided by the `ocelescope` package).  
- Resource classes can include any number of properties and methods required by your plugin.  
- Metadata such as `label` and `description` can be added to improve how the resource appears in the frontend.  
- Resources can be shared across plugins if they have the same **class name** and **field definitions**.

```python title="Example: Defining a Resource"
from ocelescope import Resource

class Example(Resource):
    label = "Example Resource"
    description = "An example resource definition"
    property_a: str
    property_b: list[int]
```

!!! warning "Resources Must Be JSON-Serializable"
    For import and export to work, resources **must** be serializable and instantiable from their serialized form.

    Fields should use standard types such as `str`, `int`, `float`, `bool`, `list`, or `dict`, or any custom subclass that is itself serializable.

    To verify that your resource is serializable, try creating an instance from its own serialized output:

    ```python
    Example(Example(property_a="Example String", property_b=[1, 2, 3]).model_dump())
    ```

## Visualization

Visualizations in **Ocelescope** allow resources to render themselves in the frontend using predefined visualization types such as graphs, SVGs, and tables.

To enable visualization for a resource, implement the `visualize()` method in your `Resource` subclass. This method should return one of the supported visualization objects described below.

### Supported Visualization Types

#### Graph

A layouted graph composed of nodes and edges. Commonly used for Petri nets, directly-follows graphs, and other graph-based models.

- **Classes**: `Graph`, `GraphNode`, `GraphEdge`
- **Layout**: Graphviz-based layouts via `.layout_graph()`

##### GraphNode

Defines a visual node in the graph.

| Field          | Type                                  | Description                                 |
| ---------------| ------------------------------------- | ------------------------------------------- |
| `id`            | `str`                                 | Unique node ID                              |
| `label`         | `Optional[str]`                       | Display label                               |
| `shape`         | `Literal[...]`                        | Node shape (`circle`, `rectangle`, etc.)    |
| `width`, `height` | `Optional[float]`                   | Dimensions in pixels                        |
| `color`         | `Optional[str]`                       | Fill color (hex or named)                   |
| `x`, `y`        | `Optional[float]`                     | Coordinates after layout (auto-set)         |
| `border_color`  | `Optional[str]`                       | Border/stroke color                         |
| `label_pos`     | `Optional["top","center","bottom"]`   | Label position                              |

##### GraphEdge

Represents a directed connection between nodes.

| Field      | Type                                  | Description                                          |
| -----------| ------------------------------------- | ---------------------------------------------------- |
| `source`   | `str`                                 | Source node ID                                       |
| `target`   | `str`                                 | Target node ID                                       |
| `arrows`   | `tuple[Optional[str], Optional[str]]` | Arrowheads at start/end (e.g., `(None, "triangle")`) |
| `color`    | `Optional[str]`                       | Edge color                                           |
| `label`    | `Optional[str]`                       | Label text                                           |

##### Layout with `.layout_graph()`

```python
Graph(
    type="graph",
    nodes=[...],
    edges=[...]
).layout_graph({
    "engine": "dot",      # Graphviz engine: dot, neato, etc.
    "dot_attr": {
        "rankdir": "LR",   # Layout direction: LR (left-right), TB (top-bottom)
        "nodesep": "0.5",  # Node spacing
        "ranksep": "0.5"   # Layer spacing
    }
})
```

The `.layout_graph()` method automatically assigns positions (`x`, `y`) and dimensions (`width`, `height`) using Graphviz layout results.

#### SVG

Use raw SVG markup when a graph-based layout is not appropriate, or when you need full control over visuals.

- **Class**: `SVGVis`
- **Use case**: Custom layouts, charts, icons, or any visualization expressible as SVG.

**Example with Graphviz**

```python
from ocelescope.visualization.default.svg import SVGVis
from graphviz import Digraph

class MySVGGraphvizResource(Resource):
    def visualize(self):
        dot = Digraph(engine="dot")
        dot.node("A", "Start", shape="circle", style="filled", fillcolor="#ffcc00")
        dot.node("B", "End", shape="doublecircle", style="filled", fillcolor="#66ccff")
        dot.edge("A", "B", label="transition")
        return SVGVis.from_graph(dot)
```

**Example with Raw SVG String**

```python
from ocelescope.visualization.default.svg import SVGVis

class MyRawSVGResource(Resource):
    def visualize(self):
        svg = """
        <svg xmlns='http://www.w3.org/2000/svg' width='200' height='100'>
            <circle cx='50' cy='50' r='40' fill='#ffcc00'/>
            <text x='50' y='55' text-anchor='middle' font-size='14'>Hello</text>
        </svg>
        """
        return SVGVis(type="svg", svg=svg)
```

#### Table

A structured table with typed columns and customizable rows. Ideal for datasets, summaries, or event logs.

- **Class**: `Table`
- **Column Class**: `TableColumn`
- **Supported Column Types**: `string`, `number`, `boolean`, `date`, `datetime`

```python
from ocelescope.visualization.default.table import Table, TableColumn

class MyTableResource(Resource):
    def visualize(self):
        return Table(
            columns=[
                TableColumn(id="name", label="Name", data_type="string"),
                TableColumn(id="age", label="Age", data_type="number"),
                TableColumn(id="member", label="Is Member", data_type="boolean"),
                TableColumn(id="joined", label="Join Date", data_type="date")
            ],
            rows=[
                {"name": "Alice", "age": 30, "member": True, "joined": "2022-01-15"},
                {"name": "Bob", "age": 25, "member": False, "joined": "2023-06-10"},
                {"name": "Charlie", "age": 40, "member": True, "joined": "2021-09-20"}
            ]
        )
```

The table supports sorting, hiding, and formatting options for each column.

For advanced use cases, you can contribute your own visualization types to the Ocelescope framework.
