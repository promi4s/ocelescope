from typing import Annotated

from pydantic import Field

from ocelescope import OCEL
from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    EID_COL,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.ocel.constants.tables import E2O_TABLE, EVENTS_TABLE, OBJECTS_TABLE
from ocelescope.resource.default.dfg import DFGActivity, DFGEdge, DFGObject, DirectlyFollowsGraph
from ocelescope.util.sql import ident, literal

OBJECT_TYPE_COL = "object_type"
SOURCE_COL = "source"
TARGET_COL = "target"
COUNT_COL = "count"
OBJECT_COUNT_COL = "object_count"


def _dfg_query(
    included_object_types: list[str] | None = None, included_activities: list[str] | None = None
) -> str:
    eid, oid, otype = ident(EID_COL), ident(OID_COL), ident(OTYPE_COL)
    activity, timestamp = ident(ACTIVITY_COL), ident(TIMESTAMP_COL)

    activity_filter = (
        f"WHERE {activity} IN ({','.join(literal(activity_name) for activity_name in included_activities)})"
        if included_activities is not None
        else ""
    )

    object_type_filter = (
        f"WHERE {otype} IN ({','.join(literal(object_type) for object_type in included_object_types)})"
        if included_object_types is not None
        else ""
    )

    return f"""
        WITH occurrence AS (
            SELECT DISTINCT
                rel.{oid} AS oid,
                rel.{eid} AS eid,
                e.{activity} AS activity,
                e.{timestamp} AS ts
            FROM {ident(E2O_TABLE)} rel
            JOIN {ident(EVENTS_TABLE)} e USING ({eid})
            {activity_filter}
        ),
        stepped AS (
            SELECT
                occ.oid,
                occ.activity,
                lag(occ.activity) OVER w AS prev_activity,
                lead(occ.eid) OVER w IS NULL AS is_last
            FROM occurrence occ
            WINDOW w AS (PARTITION BY occ.oid ORDER BY occ.ts, occ.eid)
        ),
        edge AS (
            SELECT oid, prev_activity AS source, activity AS target
            FROM stepped
            UNION ALL
            SELECT oid, activity AS source, NULL AS target
            FROM stepped
            WHERE is_last
        )
        SELECT
            o.{otype} AS {ident(OBJECT_TYPE_COL)},
            edge.source AS {ident(SOURCE_COL)},
            edge.target AS {ident(TARGET_COL)},
            count(*) AS {ident(COUNT_COL)},
            count(DISTINCT edge.oid) AS {ident(OBJECT_COUNT_COL)}
        FROM edge
        JOIN {ident(OBJECTS_TABLE)} o ON o.{oid} = edge.oid
        {object_type_filter}
        GROUP BY ALL

    """


def ocdfg_miner(
    ocel: OCEL,
    frequency_threshold: Annotated[
        float,
        Field(
            ge=0,
            le=1,
        ),
    ] = 1,
    included_activities: list[str] | None = None,
    included_object_types: list[str] | None = None,
) -> DirectlyFollowsGraph:
    edges = [
        DFGEdge(
            object_type=object_type,
            source=source,
            target=target,
            count=count,
            object_count=object_count,
            annotation=f"{count} ({object_count})",
        )
        for object_type, source, target, count, object_count in ocel.sql(
            _dfg_query(
                included_activities=included_activities, included_object_types=included_object_types
            )
        ).fetchall()
    ]

    activities = sorted({name for edge in edges for name in (edge.source, edge.target) if name})
    object_types = sorted({edge.object_type for edge in edges})
    dfg = DirectlyFollowsGraph(
        activities=[DFGActivity(name=name) for name in activities],
        object_types=[DFGObject(name=name) for name in object_types],
        edges=edges,
    )
    return dfg.filter_edges(frequency_threshold)
