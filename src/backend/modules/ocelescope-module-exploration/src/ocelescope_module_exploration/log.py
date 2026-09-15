"""The log an analysis reads, and the few helpers every analysis shares.

An analysis validates its parameters against the *original* log - the one its
editor offered choices from - and computes its result from the *filtered* log.
A filter can therefore empty a chart, but never invalidate it.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from ocelescope_module_ocel.util.attributes import EntityType, typed_attributes
from pydantic import BaseModel, Field

from ocelescope import OCEL

#: Every query can use these, so no analysis spells out the OCEL joins.
#: `rel` holds each event-object relation once, with its event's activity and
#: timestamp and its object's type. Relations to events or objects missing
#: from the log are dropped by the inner joins.
BASE = """
ev AS (
    SELECT "ocel:eid" AS eid, "ocel:activity" AS activity, "ocel:timestamp" AS ts
    FROM events
),
rel AS (
    SELECT DISTINCT r."ocel:eid" AS eid, r."ocel:oid" AS oid,
           e."ocel:activity" AS activity, e."ocel:timestamp" AS ts, o."ocel:type" AS type
    FROM e2o r JOIN events e USING ("ocel:eid") JOIN objects o USING ("ocel:oid")
)
"""


class InvalidQuery(ValueError):
    """The query does not fit the log. Reported to the client as a 400."""


class Result(BaseModel):
    """What every analysis returns: tidy rows, plus named population figures."""

    rows: list[dict[str, Any]]
    meta: dict[str, Any] = Field(default_factory=dict)


@dataclass(frozen=True)
class Log:
    filtered: OCEL
    original: OCEL

    def rows(self, query: str, *params: object) -> list[dict[str, Any]]:
        """Run `query` on the filtered log. It may start with further CTEs."""
        relation = self.filtered.sql(with_base(query), list(params))
        return [
            dict(zip(relation.columns, row, strict=True)) for row in relation.fetchall()
        ]

    def column(self, query: str, *params: object) -> list[Any]:
        """The first column of `query`'s result, on the filtered log."""
        return [
            row[0]
            for row in self.filtered.sql(with_base(query), list(params)).fetchall()
        ]

    def require_activities(self, *activities: str) -> None:
        known = {str(activity) for activity in self.original.events.activities}
        for activity in activities:
            if activity not in known:
                raise InvalidQuery(f"Unknown activity '{activity}'")

    def require_object_type(self, object_type: str) -> None:
        if object_type not in set(self.original.objects.types):
            raise InvalidQuery(f"Unknown object type '{object_type}'")

    def attribute_type(self, entity: EntityType, attribute: str, scope: str) -> str:
        """How `attribute` is analysed within one activity or object type.

        Also the existence check: an attribute that never holds a value in
        `scope` is not one an editor could have offered.
        """
        typed = typed_attributes(self.original, entity, [attribute], [scope])
        if not typed:
            raise InvalidQuery(f"Unknown attribute '{attribute}' for '{scope}'")
        return typed[0].analytical_type


def with_base(query: str) -> str:
    """Prefix `query` - a SELECT, or CTEs followed by one - with `BASE`."""
    joiner = " " if re.match(r"\s*select\b", query, re.IGNORECASE) else ", "
    return f"WITH {BASE}{joiner}{query}"
