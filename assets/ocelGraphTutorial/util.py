from pydantic import BaseModel

from ocelescope import (
    Graph,
    GraphEdge,
    GraphNode,
    GraphvizLayoutConfig,
    Resource,
    generate_color_map,
)


class EventNode(BaseModel):
    id: str
    activity: str


class ObjectNode(BaseModel):
    id: str
    object_type: str


class Relation(BaseModel):
    qualifier: str
    source: str
    target: str
    object_type: str | None = None


class OCELGraph(Resource):
    label = "Ocel Graph"
    description = "A Ocel graph"

    events: list[EventNode] = []
    objects: list[ObjectNode] = []
    relations: list[Relation] = []

    @property
    def event_ids(self) -> list[str]:
        return [event.id for event in self.events]

    @property
    def object_ids(self) -> list[str]:
        return [object.id for object in self.objects]

    def visualize(self) -> Graph:
        color_map = generate_color_map(
            list(set([object.object_type for object in self.objects]))
        )

        object_nodes = [
            GraphNode(
                id=object_node.id,
                shape="rectangle",
                label=object_node.id,
                color=color_map[object_node.object_type],
            )
            for object_node in self.objects
        ]

        event_nodes = [
            GraphNode(id=event.id, shape="rectangle", label=event.id)
            for event in self.events
        ]

        edges = [
            GraphEdge(
                source=edge.source,
                target=edge.target,
                label=edge.qualifier,
                color=color_map[edge.object_type] if edge.object_type else None,
            )
            for edge in self.relations
        ]

        return Graph(
            type="graph",
            nodes=object_nodes + event_nodes,
            edges=edges,
            layout_config=GraphvizLayoutConfig(
                engine="neato", graphAttrs={"overlap": "prism"}
            ),
        )
