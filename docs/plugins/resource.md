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

A graph composed of nodes and edges. Commonly used for Petri nets, directly-follows graphs, and other graph-based models.

- **Classes**: `Graph`, `GraphNode`, `GraphEdge`, `GraphvizLayoutConfig`
- **Layout**: Controlled by Graphviz engines and attributes (`GraphvizLayoutConfig`)

##### GraphNode

Defines a visual node in the graph.

| Field             | Type                                                           | Description                         |
| ----------------- | -------------------------------------------------------------- | ----------------------------------- |
| `id`              | `str`                                                          | Unique node ID                      |
| `label`           | `Optional[str]`                                                | Display label                       |
| `shape`           | `Literal["circle","triangle","rectangle","diamond","hexagon"]` | Node shape                          |
| `width`, `height` | `Optional[float]`                                              | Dimensions in pixels                |
| `color`           | `Optional[str]`                                                | Fill color (hex or named)           |
| `x`, `y`          | `Optional[float]`                                              | Coordinates after layout (auto-set) |
| `border_color`    | `Optional[str]`                                                | Border/stroke color                 |
| `label_pos`       | `Optional[Literal["top","center","bottom"]]`                   | Label position                      |

##### GraphEdge

Represents a directed connection between nodes.

| Field    | Type                          | Description                                          |
| -------- | ----------------------------- | ---------------------------------------------------- |
| `source` | `str`                         | Source node ID                                       |
| `target` | `str`                         | Target node ID                                       |
| `arrows` | `tuple[EdgeArrow, EdgeArrow]` | Arrowheads at start/end (e.g., `(None, "triangle")`) |
| `color`  | `Optional[str]`               | Edge color                                           |
| `label`  | `Optional[str]`               | Label text                                           |

##### GraphvizLayoutConfig

Specifies layout settings passed to Graphviz.

| Field        | Type                      | Description                                           |       |         |                                                                 |
| ------------ | ------------------------- | ----------------------------------------------------- | ----- | ------- | --------------------------------------------------------------- |
| `engine`     | `GraphVizLayoutingEngine` | Graphviz engine (`dot`, `neato`, `fdp`, `sfdp`, etc.) |       |         |                                                                 |
| `graphAttrs` | \`dict\[str, str          | int                                                   | float | bool]\` | Attributes applied to the whole graph (e.g., `rankdir`, `size`) |
| `nodeAttrs`  | \`dict\[str, str          | int                                                   | float | bool]\` | Default attributes for all nodes (e.g., `shape`, `color`)       |
| `edgeAttrs`  | \`dict\[str, str          | int                                                   | float | bool]\` | Default attributes for all edges (e.g., `arrowsize`, `color`)   |

##### Example Usage

```python
Graph(
    type="graph",
    nodes=[...],
    edges=[...],
    layout_config=GraphvizLayoutConfig(
        engine="dot",
        graphAttrs={
            "rankdir": "LR",   # Layout direction: LR (left-right), TB (top-bottom)
            "nodesep": "0.5",  # Node spacing
            "ranksep": "0.5"   # Layer spacing
        },
   )
)
```

Graphviz will apply the chosen engine and attributes to determine positions (`x`, `y`) and dimensions (`width`, `height`) automatically.

---

#### SVG

Use raw SVG markup when a graph-based layout is not appropriate, or when you need full control over visuals.

- **Class**: `SVGVis`
- **Use case**: Custom layouts, charts, icons, or any visualization expressible as SVG.

**Example**

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

---

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

For advanced use cases, you can contribute your own visualization types to the Ocelescope framework

---

#### Dot

A raw Graphviz DOT visualization, preserving the full DOT source string. Useful when you want direct control over Graphviz rendering or need to reuse an existing DOT description.

- **Class**: `DotVis`
- **Layout**: Explicitly set by Graphviz via a chosen layout engine (`dot`, `neato`, `fdp`, etc.)

##### DotVis

| Field           | Type                      | Description                                                              |
| --------------- | ------------------------- | ------------------------------------------------------------------------ |
| `type`          | `Literal["dot"]`          | Identifies the visualization type as DOT                                 |
| `dot_str`       | `str`                     | The raw DOT source string (as produced by `graphviz.Digraph` or `Graph`) |
| `layout_engine` | `GraphVizLayoutingEngine` | The Graphviz engine used (`dot`, `neato`, `fdp`, `sfdp`, `circo`, etc.)  |

##### Supported Layout Engines

| Engine        | Description                                                    |
| ------------- | -------------------------------------------------------------- |
| `dot`         | Hierarchical layouts, suited for layered graphs and flowcharts |
| `neato`       | Spring-model layouts, good for undirected graphs               |
| `fdp`         | Force-directed placement, similar to `neato`                   |
| `sfdp`        | Scalable force-directed placement for large graphs             |
| `circo`       | Circular layouts                                               |
| `twopi`       | Radial layouts (nodes placed in concentric circles)            |
| `osage`       | Clustered layouts                                              |
| `patchwork`   | Treemap-style layouts                                          |
| `nop`, `nop2` | No-op layout engines (use raw input positions if given)        |

##### Constructing from Graphviz

Use `.from_graphviz()` to convert an existing `graphviz.Digraph` or `graphviz.Graph` object into a `DotVis`.

```python
from graphviz import Digraph
from ocelescope.visualization.default.dot import DotVis

class MyDotResource(Resource):
    def visualize(self):
        dot = Digraph()
        dot.node("A", "Start")
        dot.node("B", "End")
        dot.edge("A", "B")

        return DotVis.from_graphviz(
            graph=dot,
            layout_engine="dot"   # or "neato", "circo", etc.
        )
```

The resulting `DotVis` object carries both the DOT source (`dot_str`) and the layout engine specification, allowing full control over Graphviz rendering.
