"""Keep the entities whose attribute matches a condition."""

from __future__ import annotations

from typing import Optional, Union

import polars as pl

from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    EID_COL,
    OBJECT_CHANGED_FIELD,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.ocel.constants.tables import (
    EVENTS_TABLE,
    OBJECT_CHANGES_TABLE,
    OBJECTS_TABLE,
)
from ocelescope.ocel.filter.base import BaseFilter, Keep, utc_bound
from ocelescope.util.sql import ident, literal


class _AttributeFilter(BaseFilter):
    """Shared config/predicate for the event and object attribute filters.

    An entity matches when its ``attribute`` satisfies the range / value / regex
    condition. Entities whose type does not carry the attribute at all are left
    untouched rather than dropped -- a filter on ``price`` has no opinion about
    employees, and an attribute the log does not have affects nothing.
    ``target_type`` names the affected type; without it, any type that ever has
    the attribute non-null is affected.

    Both sides run the condition in DuckDB over a ``(id, type, value)`` relation,
    so each subclass only has to say where one entity's value is read from.
    """

    target_type: Optional[str] = None
    attribute: str
    time_range: Optional[tuple[Optional[str], Optional[str]]] = None
    number_range: Optional[tuple[Optional[float], Optional[float]]] = None
    values: Optional[list[Union[str, int, float]]] = None
    regex: Optional[str] = None

    def _match(self, params: list[object]) -> str:
        """The condition on ``value``, appending its binds to ``params``.

        Casts rather than compares directly: an attribute is stored under the type
        the log declares for it, which a bound of a different kind would not
        compare against at all. ``TRY_CAST`` makes a value that contradicts the
        condition's kind NULL, so it fails the comparison instead of the query.
        """
        conditions: list[str] = []

        if self.number_range is not None:
            low, high = self.number_range
            for bound, comparison in ((low, ">="), (high, "<=")):
                if bound is not None:
                    conditions.append(f"TRY_CAST(value AS DOUBLE) {comparison} ?")
                    params.append(float(bound))

        if self.time_range is not None:
            low, high = (utc_bound(bound) for bound in self.time_range)
            for bound, comparison in ((low, ">="), (high, "<=")):
                if bound is not None:
                    conditions.append(f"TRY_CAST(value AS TIMESTAMP) {comparison} ?")
                    params.append(bound)

        if self.values is not None:
            numeric = all(
                isinstance(value, (int, float)) and not isinstance(value, bool)
                for value in self.values
            )
            placeholders = ", ".join(["?"] * len(self.values))
            if not self.values:
                conditions.append("false")
            elif numeric:
                conditions.append(f"TRY_CAST(value AS DOUBLE) IN ({placeholders})")
                params.extend(float(value) for value in self.values)
            else:
                conditions.append(f"value::VARCHAR IN ({placeholders})")
                params.extend(str(value) for value in self.values)

        if self.regex is not None:
            conditions.append("regexp_matches(value::VARCHAR, ?)")
            params.append(self.regex)

        return " AND ".join(conditions) or "true"

    def _keep(self, ocel, source: str, id_col: str) -> pl.LazyFrame:
        """The ids to keep, over a ``source`` selecting ``(id, type, value)``.

        The id goes back out under its own name: the engine intersects what the
        filters keep by joining the frames on it.
        """
        params: list[object] = []
        if self.target_type is not None:
            untouched = "type IS DISTINCT FROM ?"
            params.append(self.target_type)
        else:
            untouched = "type NOT IN (SELECT type FROM entity WHERE value IS NOT NULL)"

        return ocel.sql(
            f"WITH entity AS ({source}) "
            f"SELECT id AS {ident(id_col)} FROM entity "
            f"WHERE {untouched} OR ({self._match(params)})",
            params,
        ).pl(lazy=True)


class EventAttributeFilter(_AttributeFilter):
    """Keep the events whose attribute matches; activities without it are untouched."""

    def keep(self, ocel) -> Keep:
        if self.attribute not in ocel.events.attribute_names:
            return Keep()

        return Keep(
            events=self._keep(
                ocel,
                f"SELECT {ident(EID_COL)} AS id, {ident(ACTIVITY_COL)} AS type, "
                f"{ident(self.attribute)} AS value FROM {EVENTS_TABLE}",
                EID_COL,
            )
        )


class ObjectAttributeFilter(_AttributeFilter):
    """Keep the objects whose attribute matches; types without it are untouched.

    An object attribute is read from its change rows, which is where every value
    it ever holds is stored. A dynamic attribute therefore has several, and the
    earliest is the one filtered on -- the object's value as it started out.
    """

    def keep(self, ocel) -> Keep:
        if self.attribute not in ocel.objects.attribute_names:
            return Keep()

        oid, ts = ident(OID_COL), ident(TIMESTAMP_COL)
        return Keep(
            objects=self._keep(
                ocel,
                f"SELECT o.{oid} AS id, o.{ident(OTYPE_COL)} AS type, earliest.value "
                f"FROM {OBJECTS_TABLE} o LEFT JOIN ("
                f"SELECT {oid}, arg_min({ident(self.attribute)}, {ts}) AS value "
                f"FROM {OBJECT_CHANGES_TABLE} "
                f"WHERE {ident(OBJECT_CHANGED_FIELD)} = {literal(self.attribute)} "
                f"GROUP BY {oid}"
                f") earliest ON earliest.{oid} = o.{oid}",
                OID_COL,
            )
        )
