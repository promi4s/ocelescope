from typing import Annotated

from pydantic import Field

from ocelescope import OCEL
from ocelescope.discovery.decorator import discovery_method
from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    EID_COL,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.ocel.constants.tables import E2O_TABLE, EVENTS_TABLE, OBJECTS_TABLE
from ocelescope.resource.default.dfg import DFGActivity, DFGEdge, DFGObject, DirectlyFollowsGraph
from ocelescope.util.sql import ident

OBJECT_TYPE_COL = "object_type"
SOURCE_COL = "source"
TARGET_COL = "target"
COUNT_COL = "count"


def _dfg_query() -> str:
    eid, oid, otype = ident(EID_COL), ident(OID_COL), ident(OTYPE_COL)
    activity, timestamp = ident(ACTIVITY_COL), ident(TIMESTAMP_COL)

    return f"""
        WITH occurrence AS (
            SELECT DISTINCT
                rel.{oid} AS oid,
                rel.{eid} AS eid,
                e.{activity} AS activity,
                e.{timestamp} AS ts
            FROM {ident(E2O_TABLE)} rel
            JOIN {ident(EVENTS_TABLE)} e USING ({eid})
        ),
        stepped AS (
            SELECT
                occ.oid,
                occ.eid,
                occ.activity,
                lag(occ.activity) OVER w AS prev_activity,
                lag(occ.eid) OVER w AS prev_eid,
                lead(occ.eid) OVER w IS NULL AS is_last
            FROM occurrence occ
            WINDOW w AS (PARTITION BY occ.oid ORDER BY occ.ts, occ.eid)
        ),
        edge AS (
            SELECT oid, prev_activity AS source, activity AS target, prev_eid, eid
            FROM stepped
            UNION ALL
            SELECT oid, activity AS source, NULL AS target, eid, NULL
            FROM stepped
            WHERE is_last
        )
        SELECT
            o.{otype} AS {ident(OBJECT_TYPE_COL)},
            edge.source AS {ident(SOURCE_COL)},
            edge.target AS {ident(TARGET_COL)},
            count(DISTINCT (edge.prev_eid, edge.eid)) AS {ident(COUNT_COL)}
        FROM edge
        JOIN {ident(OBJECTS_TABLE)} o ON o.{oid} = edge.oid
        GROUP BY ALL
    """


@discovery_method(
    name="Object-Centric DFG",
    description="Discover an object-centric directly-follows graph.",
)
def ocdfg_miner(
    ocel: OCEL,
    frequency_threshold: Annotated[
        float,
        Field(
            ge=0,
            le=1,
            title="Frequency Threshold",
            description="Percentage of edges too keep (1 = keep all). Frequency Values of edges are determined with respect to the absolute count of their object types.",
        ),
    ] = 1,
) -> DirectlyFollowsGraph:
    edges = [
        DFGEdge(
            object_type=object_type,
            source=source,
            target=target,
            count=count,
            annotation=str(count),
        )
        for object_type, source, target, count in ocel.sql(_dfg_query()).fetchall()
    ]

    activities = sorted({name for edge in edges for name in (edge.source, edge.target) if name})
    object_types = sorted({edge.object_type for edge in edges})

    dfg = DirectlyFollowsGraph(
        activities=[DFGActivity(name=name) for name in activities],
        object_types=[DFGObject(name=name) for name in object_types],
        edges=edges,
    )
    return dfg.filter_edges(1 - frequency_threshold)
