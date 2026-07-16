"""E2O / O2O relation-count summaries and combinations, computed in DuckDB.

Every relation is normalized to ``(src_id, src_type, tgt_id, tgt_type, qualifier)`` so
E2O and O2O share one implementation, parametrized by ``direction`` (which side is the
source). ``relation_summary`` reports, per ``(source_type, target_type[, qualifier])``,
the min / max / sum number of targets a single source instance relates to;
``combinations`` lists the distinct source/qualifier/target triples.
"""

from __future__ import annotations

from typing import Literal

from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    EID_COL,
    O2O_SOURCE_ID,
    O2O_TARGET_ID,
    OID_COL,
    OTYPE_COL,
)
from ocelescope.util.sql import ident
from ocelescope_backend.app.internal.model.base import PaginatedResponse

from ocelescope import OCEL

from ocelescope_module_ocel.models import RelationCombination, RelationCountSummary

QUALIFIER = "ocel:qualifier"

RelationKind = Literal["e2o", "o2o"]
Direction = Literal["source", "target"]


def _normalized_relation(kind: RelationKind, direction: Direction) -> str:
    """SQL selecting a relation as (src_id, src_type, tgt_id, tgt_type, qualifier).

    ``direction`` picks which side of the relation is the *source*:
      - e2o "source": event -> object   ("target": object -> event)
      - o2o "source": oid_1 -> oid_2     ("target": oid_2 -> oid_1)
    The object/event types are joined on so grouping can be done by type.
    """
    if kind == "e2o":
        base = (
            f"e2o r "
            f"JOIN events e ON r.{ident(EID_COL)} = e.{ident(EID_COL)} "
            f"JOIN objects o ON r.{ident(OID_COL)} = o.{ident(OID_COL)}"
        )
        event = (f"e.{ident(EID_COL)}", f"e.{ident(ACTIVITY_COL)}")
        obj = (f"o.{ident(OID_COL)}", f"o.{ident(OTYPE_COL)}")
        src, tgt = (event, obj) if direction == "source" else (obj, event)
    else:
        base = (
            f"o2o r "
            f"JOIN objects s ON r.{ident(O2O_SOURCE_ID)} = s.{ident(OID_COL)} "
            f"JOIN objects t ON r.{ident(O2O_TARGET_ID)} = t.{ident(OID_COL)}"
        )
        first = (f"s.{ident(OID_COL)}", f"s.{ident(OTYPE_COL)}")
        second = (f"t.{ident(OID_COL)}", f"t.{ident(OTYPE_COL)}")
        src, tgt = (first, second) if direction == "source" else (second, first)

    return (
        f"SELECT {src[0]} AS src_id, {src[1]} AS src_type, "
        f"{tgt[0]} AS tgt_id, {tgt[1]} AS tgt_type, "
        f"r.{ident(QUALIFIER)} AS qualifier FROM {base}"
    )


def relation_summary(
    ocel: OCEL,
    kind: RelationKind,
    direction: Direction = "source",
    source_types: list[str] | None = None,
    target_types: list[str] | None = None,
    qualifiers: list[str] | None = None,
    with_qualifier: bool = True,
    drop_constant: bool = False,
    page: int | None = None,
    page_size: int | None = None,
) -> PaginatedResponse[list[RelationCountSummary]]:
    """Per (source_type, target_type[, qualifier]) multiplicity stats, in DuckDB.

    For every source instance we count how many targets it relates to, then per group
    report min / max / sum of those counts. ``min_count`` is 0 when not every instance
    of the source type participates (some have no such relation). ``with_qualifier``
    adds the qualifier to the grouping; otherwise every pair lists its qualifiers.
    ``source_types`` / ``target_types`` / ``qualifiers`` filter the relations (each
    ``None`` = no filter). ``drop_constant`` drops groups whose multiplicity never
    varies (``min_count == max_count``, e.g. always exactly one target).

    Groups are ordered by (source, target, qualifier) for stable pages and sliced by
    ``page`` / ``page_size``; omitting both returns a single page with every group. The
    grouped result is small -- one row per type combination -- so it is ordered and
    paged in Python; the heavy per-instance aggregation happens in DuckDB.
    """
    keys = ["src_type", "tgt_type"] + (["qualifier"] if with_qualifier else [])
    key_sql = ", ".join(keys)

    params: list[object] = []
    conditions: list[str] = []
    # A qualifier-grouped row needs a qualifier (drop null-qualifier relations).
    if with_qualifier:
        conditions.append("qualifier IS NOT NULL")

    def add_filter(column: str, values: list[str] | None) -> None:
        if values is not None:
            params.extend(values)
            conditions.append(f"{column} IN ({', '.join(['?'] * len(values))})")

    add_filter("src_type", source_types)
    add_filter("tgt_type", target_types)
    add_filter("qualifier", qualifiers)
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    # All instances of the source type -- so min can drop to 0 when some don't relate.
    if kind == "e2o" and direction == "source":
        instances = f"SELECT {ident(ACTIVITY_COL)} AS src_type FROM events"
    else:
        instances = f"SELECT {ident(OTYPE_COL)} AS src_type FROM objects"

    ctes = [
        f"rel AS ({_normalized_relation(kind, direction)})",
        f"filtered AS (SELECT * FROM rel {where})",
        f"per_source AS (SELECT {key_sql}, src_id, count(*) AS cnt "
        f"FROM filtered GROUP BY {key_sql}, src_id)",
        f"summary AS (SELECT {key_sql}, min(cnt) AS min_count, max(cnt) AS max_count, "
        f"sum(cnt) AS total_sum, count(*) AS contributing FROM per_source GROUP BY {key_sql})",
        f"totals AS (SELECT src_type, count(*) AS total FROM ({instances}) GROUP BY src_type)",
    ]

    select = ["s.src_type", "s.tgt_type"]
    join = "JOIN totals t ON s.src_type = t.src_type"
    if with_qualifier:
        select.append("s.qualifier")
    else:
        # Aggregated pairs list every qualifier seen for that (source, target).
        ctes.append(
            "pair_qualifiers AS (SELECT src_type, tgt_type, "
            "array_agg(DISTINCT qualifier) AS qualifiers FROM filtered "
            "WHERE qualifier IS NOT NULL GROUP BY src_type, tgt_type)"
        )
        join += (
            " LEFT JOIN pair_qualifiers q "
            "ON s.src_type = q.src_type AND s.tgt_type = q.tgt_type"
        )
    select += [
        "CASE WHEN s.contributing < t.total THEN 0 ELSE s.min_count END AS min_count",
        "s.max_count",
        "s.total_sum",
    ]
    if not with_qualifier:
        select.append("q.qualifiers")

    query = f"WITH {', '.join(ctes)} SELECT {', '.join(select)} FROM summary s {join}"
    rows = ocel.sql(query, params).fetchall()

    summaries: list[RelationCountSummary] = []
    for row in rows:
        if with_qualifier:
            src_type, tgt_type, qualifier, min_count, max_count, total_sum = row
            row_qualifiers = [qualifier]
        else:
            src_type, tgt_type, min_count, max_count, total_sum, quals = row
            qualifier = ""
            row_qualifiers = sorted(q for q in (quals or []) if q is not None)
        summaries.append(
            RelationCountSummary(
                source=src_type,
                target=tgt_type,
                qualifier=qualifier or "",
                qualifiers=row_qualifiers,
                min_count=int(min_count),
                max_count=int(max_count),
                sum=int(total_sum),
            )
        )

    if drop_constant:
        summaries = [s for s in summaries if s.min_count != s.max_count]

    summaries.sort(key=lambda s: (s.source, s.target, s.qualifier))

    total_items = len(summaries)
    page = page or 1
    page_size = page_size or total_items or 1
    start = (page - 1) * page_size
    return PaginatedResponse(
        response=summaries[start : start + page_size],
        page=page,
        page_size=page_size,
        total_items=total_items,
    )


def combinations(
    ocel: OCEL,
    kind: RelationKind,
    direction: Direction = "source",
) -> list[RelationCombination]:
    """Every distinct (source_type, qualifier, target_type) the relation contains.

    ``direction`` flips which side is the source (see ``_normalized_relation``); a null
    qualifier is reported as an empty string.
    """
    query = (
        f"SELECT DISTINCT src_type, tgt_type, qualifier "
        f"FROM ({_normalized_relation(kind, direction)}) "
        f"ORDER BY src_type, tgt_type, qualifier"
    )
    return [
        RelationCombination(source=src_type, target=tgt_type, qualifier=qualifier or "")
        for src_type, tgt_type, qualifier in ocel.sql(query).fetchall()
    ]
