# Resources

Resources are the main mechanism to define **inputs** and **outputs** of Ocelescope plugin methods.

When you define a resource, it becomes **exportable** and **importable** by default through an automatic exchange format.

Resources can also provide a visualization so they can be displayed in the frontend.

<figure markdown="span">
  ![An example plugin class](../assets/ResourceOverview.png){width="600"}
</figure>

## Defining a resource

Define a resource by creating a Python class that inherits from `Resource` (from the `ocelescope` package). The structure of the resource is described through typed fields on the class. You can also set `label` and `description` to control how the resource appears in the frontend.

If you want to reuse a resource across plugins, keep the **class name** and the **field definitions** identical.

```python title="Example: defining a resource"
from ocelescope import Resource

class Example(Resource):
    label = "Example Resource"
    description = "An example resource definition"

    property_a: str
    property_b: list[int]
```

!!! warning "Resources must be JSON-serializable"
    For import and export to work, a resource must be serializable and instantiable from its serialized form.

    Use standard types like `str`, `int`, `float`, `bool`, `list`, or `dict`, or custom types that are themselves serializable.

    If you use nested classes (for example, a resource that contains nodes and edges), make those nested classes Pydantic models (inherit from `pydantic.BaseModel`) so they can be validated and serialized consistently.

    ```python
    from pydantic import BaseModel
    from ocelescope import Resource

    class Node(BaseModel):
        id: str
        label: str

    class Edge(BaseModel):
        source: str
        target: str
        label: str | None = None

    class GraphResource(Resource):
        nodes: list[Node]
        edges: list[Edge]

    # Quick round-trip check (serialize -> create again)
    GraphResource(
        GraphResource(
            nodes=[Node(id="n1", label="Start"), Node(id="n2", label="End")],
            edges=[Edge(source="n1", target="n2", label="go")]
        ).model_dump()
    )
    ```

## Using resources in plugin methods

Ocelescope inspects the **type hints** of plugin methods. Resource types used as parameters are treated as **resource inputs**, and resource types used as the return type are treated as **resource outputs** and saved in the session for later use.

```python title="Resources as input and output"
from ocelescope import Plugin, Resource, plugin_method

class MyResource(Resource):
    label = "My Resource"
    description = "Example resource"
    value: int

class ExamplePlugin(Plugin):
    label = "Example Plugin"
    description = "Shows how resources are registered via type hints"
    version = "1.0"

    @plugin_method(label="Increment resource")
    def increment(self, x: MyResource) -> MyResource:
        return MyResource(value=x.value + 1)
```

## Visualizing resources

Resources can provide a visualization so they can be displayed in the frontend.

A simple example is to return a Plotly figure from your resource:

```python title="Example: Plotly visualization"
from ocelescope import Resource
from ocelescope.visualization.default.plotly import Plotly

import plotly.graph_objects as go


class Curve(Resource):
    x: list[float]
    y: list[float]

    def visualize(self):
        fig = go.Figure(data=go.Scatter(x=self.x, y=self.y, mode="lines"))
        fig.update_layout(title="Curve")
        return Plotly(figure=fig)
```

### Overview

| Visualization | Class | What it shows | Reference |
|---|---|---|---|
| Graph | `Graph` | Node/edge graph with Graphviz-based layout | `../references/visualizations/graph.md` |
| Dot | `DotVis` | Raw Graphviz DOT string (choose layout engine) | `../references/visualizations/dot.md` |
| SVG | `SVGVis` | Raw SVG markup | `../references/visualizations/svg.md` |
| Table | `Table` | Table with typed columns and rows | `../references/visualizations/table.md` |
| Plotly | `Plotly` | Interactive Plotly figure serialized to JSON | `../references/visualizations/plotly.md` |
