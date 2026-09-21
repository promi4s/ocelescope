from typing import Literal

from pydantic import BaseModel, Field

from ocelescope.visualization.visualization import Visualization


class DFG(BaseModel):
    """A directly-follows graph in the shape the r4pm viewers expect.

    Attributes:
        activities: Occurrence count per activity.
        directly_follows_relations: ``((source, target), count)`` pairs.
        start_activities: Count per activity of how often it starts a trace.
        end_activities: Count per activity of how often it ends a trace.
    """

    activities: dict[str, int] = Field(default_factory=dict)
    directly_follows_relations: list[tuple[tuple[str, str], int]] = Field(
        default_factory=list
    )
    start_activities: dict[str, int] = Field(default_factory=dict)
    end_activities: dict[str, int] = Field(default_factory=dict)


class DirectlyFollowsGraphViz(Visualization, DFG):
    type: Literal["r4pm_dfg"] = "r4pm_dfg"


class OCDirectlyFollowsGraphViz(Visualization):
    """An object-centric directly-follows graph: one DFG per object type.

    Attributes:
        object_type_to_dfg: The directly-follows graph of each object type.
        object_counts: Number of objects per object type.
    """

    type: Literal["r4pm_ocdfg"] = "r4pm_ocdfg"
    object_type_to_dfg: dict[str, DFG] = Field(default_factory=dict)
    object_counts: dict[str, int] = Field(default_factory=dict)
