"""Keep the entities of a type by how many relations of a given kind they have."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    E2O_QUALIFIER,
    EID_COL,
    O2O_QUALIFIER,
    O2O_SOURCE_ID,
    O2O_TARGET_ID,
    OID_COL,
    OTYPE_COL,
)
from ocelescope.ocel.constants.tables import (
    E2O_TABLE,
    EVENTS_TABLE,
    O2O_TABLE,
    OBJECTS_TABLE,
)
from ocelescope.ocel.filter.base import BaseFilter, Step
from ocelescope.util.sql import ident, literal


class RelationCountFilterConfig(BaseModel):
    source: str
    target: str
    range: tuple[int | None, int | None]
    qualifier: str | None = None

    def _qualified(self, column: str) -> str:
        """SQL restricting the relations to ``qualifier``, if one is set."""
        if self.qualifier is None:
            return ""
        return f"AND {column} = {literal(self.qualifier)}"


def _keep_counted(
    table: str,
    id_col: str,
    type_col: str,
    counted_type: str,
    counted: str,
    count_range: tuple[int | None, int | None],
) -> str:
    """Ids of the counted type whose count is in range, plus every other entity.

    ``counted`` selects, under ``id``, one row per matching relation of an entity.
    An entity of another type is not what the filter is about, so it is kept
    untouched. One of the counted type with no matching relation counts as zero
    rather than going missing -- hence the left join and the coalesce -- so a
    "0 to 2" filter keeps the ones that have none.
    """
    id_col, type_col = ident(id_col), ident(type_col)
    count = "coalesce(counts.n, 0)"
    low, high = count_range
    in_range = " AND ".join(
        f"{count} {comparison} {int(bound)}"
        for bound, comparison in ((low, ">="), (high, "<="))
        if bound is not None
    )
    counted_type = literal(counted_type)

    return f"""
        SELECT e.{id_col} FROM {table} e
        LEFT JOIN (SELECT id, count(*) AS n FROM ({counted}) GROUP BY id) counts
            ON counts.id = e.{id_col}
        WHERE e.{type_col} <> {counted_type}
            OR (e.{type_col} = {counted_type} AND {in_range or "true"})
    """


class E2OCountFilter(BaseFilter, RelationCountFilterConfig):
    """Keep events (or objects) by how many E2O relations of a given kind they have.

    Counts the relations between activity ``source`` and object type ``target``
    (optionally of one ``qualifier``); ``direction`` picks whether the events
    (source) or the objects (target) are the ones counted.
    """

    direction: Literal["source", "target"] = "source"

    def build(self, step: Step) -> None:
        eid, oid = ident(EID_COL), ident(OID_COL)
        counted_col = eid if self.direction == "source" else oid
        counted = f"""
            SELECT r.{counted_col} AS id FROM {step[E2O_TABLE]} r
            JOIN {step[EVENTS_TABLE]} e USING ({eid})
            JOIN {step[OBJECTS_TABLE]} o USING ({oid})
            WHERE e.{ident(ACTIVITY_COL)} = {literal(self.source)}
                AND o.{ident(OTYPE_COL)} = {literal(self.target)}
                {self._qualified(f"r.{ident(E2O_QUALIFIER)}")}
        """

        if self.direction == "source":
            step.keep(
                EVENTS_TABLE,
                _keep_counted(
                    step[EVENTS_TABLE],
                    EID_COL,
                    ACTIVITY_COL,
                    self.source,
                    counted,
                    self.range,
                ),
            )
        else:
            step.keep(
                OBJECTS_TABLE,
                _keep_counted(
                    step[OBJECTS_TABLE],
                    OID_COL,
                    OTYPE_COL,
                    self.target,
                    counted,
                    self.range,
                ),
            )


class O2OCountFilter(BaseFilter, RelationCountFilterConfig):
    """Keep objects by how many O2O relations of a given kind they have.

    Counts the relations between object types ``source`` and ``target`` (optionally
    of one ``qualifier``); ``direction`` picks whether the source or the target
    object is the one counted.
    """

    direction: Literal["source", "target"] = "source"

    def build(self, step: Step) -> None:
        oid, otype = ident(OID_COL), ident(OTYPE_COL)
        is_source = self.direction == "source"
        counted_col = ident(O2O_SOURCE_ID if is_source else O2O_TARGET_ID)
        counted = f"""
            SELECT r.{counted_col} AS id FROM {step[O2O_TABLE]} r
            JOIN {step[OBJECTS_TABLE]} s ON s.{oid} = r.{ident(O2O_SOURCE_ID)}
            JOIN {step[OBJECTS_TABLE]} t ON t.{oid} = r.{ident(O2O_TARGET_ID)}
            WHERE s.{otype} = {literal(self.source)}
                AND t.{otype} = {literal(self.target)}
                {self._qualified(f"r.{ident(O2O_QUALIFIER)}")}
        """

        step.keep(
            OBJECTS_TABLE,
            _keep_counted(
                step[OBJECTS_TABLE],
                OID_COL,
                OTYPE_COL,
                self.source if is_source else self.target,
                counted,
                self.range,
            ),
        )
