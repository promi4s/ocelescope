"""Keep the entities whose attribute matches a condition."""

from __future__ import annotations

from typing import Literal

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
from ocelescope.ocel.filter.base import (
    BaseFilter,
    Step,
    number_literal,
    timestamp_literal,
    utc_bound,
)
from ocelescope.util.sql import ident, literal


def _attribute_names(step: Step, table: str) -> list[str]:
    """The attributes ``table`` has a column for -- every one not an OCEL column."""
    columns = step.sql(f"SELECT * FROM {step[table]} LIMIT 0").columns
    return [column for column in columns if not column.startswith("ocel:")]


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

    target_type: str | None = None
    attribute: str
    time_range: tuple[str | None, str | None] | None = None
    number_range: tuple[float | None, float | None] | None = None
    values: list[str | int | float] | None = None
    regex: str | None = None
    mode: Literal["exclude", "include"] = "include"

    def _match(self) -> str:
        """The condition on ``value``.

        Casts rather than compares directly: an attribute is stored under the type
        the log declares for it, which a bound of a different kind would not
        compare against at all. ``TRY_CAST`` makes a value that contradicts the
        condition's kind NULL, so it fails the comparison instead of the query.

        Values are inlined as literals rather than bound: the query ends up in a
        view, and a view cannot take parameters.
        """
        conditions: list[str] = []

        if self.number_range is not None:
            low, high = self.number_range
            for bound, comparison in ((low, ">="), (high, "<=")):
                if bound is not None:
                    conditions.append(
                        f"TRY_CAST(value AS DOUBLE) {comparison} {number_literal(bound)}"
                    )

        if self.time_range is not None:
            low, high = (utc_bound(bound) for bound in self.time_range)
            for bound, comparison in ((low, ">="), (high, "<=")):
                if bound is not None:
                    conditions.append(
                        f"TRY_CAST(value AS TIMESTAMP) {comparison} "
                        f"{timestamp_literal(bound)}"
                    )

        if self.values is not None:
            numeric = all(
                isinstance(value, (int, float)) and not isinstance(value, bool)
                for value in self.values
            )
            if not self.values:
                conditions.append("false")
            elif numeric:
                values = ", ".join(
                    number_literal(float(value)) for value in self.values
                )
                conditions.append(f"TRY_CAST(value AS DOUBLE) IN ({values})")
            else:
                values = ", ".join(literal(str(value)) for value in self.values)
                conditions.append(f"value::VARCHAR IN ({values})")

        if self.regex is not None:
            conditions.append(
                f"regexp_matches(coalesce(value::VARCHAR, ''), {literal(self.regex)})"
            )

        return " AND ".join(conditions) or "true"

    def _keep(self, source: str, id_col: str) -> str:
        """The ids to keep, over a ``source`` selecting ``(id, type, value)``.

        The id goes back out under its own name: the engine intersects what the
        filters keep by joining the frames on it.
        """
        if self.target_type is not None:
            untouched = f"type IS DISTINCT FROM {literal(self.target_type)}"
        else:
            untouched = "type NOT IN (SELECT type FROM entity WHERE value IS NOT NULL)"

        match = self._match()
        if self.mode == "exclude":
            match = f"NOT coalesce(({match}), false)"

        return (
            f"WITH entity AS ({source}) "
            f"SELECT id AS {ident(id_col)} FROM entity "
            f"WHERE {untouched} OR ({match})"
        )


class EventAttributeFilter(_AttributeFilter):
    """Keep the events whose attribute matches; activities without it are untouched."""

    def build(self, step: Step) -> None:
        if self.attribute not in _attribute_names(step, EVENTS_TABLE):
            return

        step.keep(
            EVENTS_TABLE,
            self._keep(
                f"SELECT {ident(EID_COL)} AS id, {ident(ACTIVITY_COL)} AS type, "
                f"{ident(self.attribute)} AS value FROM {step[EVENTS_TABLE]}",
                EID_COL,
            ),
        )


class ObjectAttributeFilter(_AttributeFilter):
    """Keep the objects whose attribute matches; types without it are untouched.

    An object attribute is read from its change rows, which is where every value
    it ever holds is stored. A dynamic attribute therefore has several, and the
    earliest is the one filtered on -- the object's value as it started out.
    """

    def build(self, step: Step) -> None:
        if self.attribute not in _attribute_names(step, OBJECT_CHANGES_TABLE):
            return

        oid, ts = ident(OID_COL), ident(TIMESTAMP_COL)
        step.keep(
            OBJECTS_TABLE,
            self._keep(
                f"SELECT o.{oid} AS id, o.{ident(OTYPE_COL)} AS type, earliest.value "
                f"FROM {step[OBJECTS_TABLE]} o LEFT JOIN ("
                f"SELECT {oid}, arg_min({ident(self.attribute)}, {ts}) AS value "
                f"FROM {step[OBJECT_CHANGES_TABLE]} "
                f"WHERE {ident(OBJECT_CHANGED_FIELD)} = {literal(self.attribute)} "
                f"GROUP BY {oid}"
                f") earliest ON earliest.{oid} = o.{oid}",
                OID_COL,
            ),
        )
