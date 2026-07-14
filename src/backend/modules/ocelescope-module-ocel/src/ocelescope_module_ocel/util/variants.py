"""Object variants (activity-sequence per object) over ``OCELDb``, in DuckDB SQL.

The variant id is ``<object_type>_<index>`` where ``index`` is the variant's rank
by descending frequency. This single source of truth is shared by the
``objectVariants`` endpoint and the variant XES export, so the ids the export
accepts are exactly the ones the endpoint hands out.
"""

from __future__ import annotations

from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    EID_COL,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope_backend.app.internal.ocel.ocel_db import OCELDb

from ocelescope_module_ocel.models import ObjectTypeVariants, ObjectVariant


def _grouped_variants(
    ocel_db: OCELDb, object_type: str
) -> list[tuple[list[str], list[str], int]]:
    """One ``(activity_sequence, object_ids, case_count)`` per distinct sequence.

    The whole grouping runs in DuckDB: each object's events are collapsed into an
    activity sequence ordered by timestamp (``ocel:eid`` breaks timestamp ties so the
    sequence -- and therefore which objects share a variant -- is deterministic), then
    identical sequences are grouped and ranked by descending case count.
    """
    query = f"""
        WITH per_object AS (
            SELECT
                o."{OID_COL}" AS oid,
                list(
                    e."{ACTIVITY_COL}" ORDER BY e."{TIMESTAMP_COL}", e."{EID_COL}"
                ) AS sequence
            FROM objects o
            JOIN e2o r ON o."{OID_COL}" = r."{OID_COL}"
            JOIN events e ON r."{EID_COL}" = e."{EID_COL}"
            WHERE o."{OTYPE_COL}" = ?
            GROUP BY o."{OID_COL}"
        )
        SELECT sequence, list(oid ORDER BY oid) AS ids, count(*) AS case_count
        FROM per_object
        GROUP BY sequence
        ORDER BY case_count DESC, sequence
    """
    return [
        (list(sequence), list(ids), int(case_count))
        for sequence, ids, case_count in ocel_db.sql(query, [object_type]).fetchall()
    ]


def _variants_with_ids(
    ocel_db: OCELDb, object_type: str
) -> tuple[list[ObjectVariant], dict[str, list[str]]]:
    variants: list[ObjectVariant] = []
    ids_by_variant: dict[str, list[str]] = {}
    for index, (sequence, ids, case_count) in enumerate(
        _grouped_variants(ocel_db, object_type)
    ):
        variant_id = f"{object_type}_{index}"
        variants.append(
            ObjectVariant(
                variant_id=variant_id,
                activities=sequence,
                event_count=len(sequence),
                case_count=case_count,
            )
        )
        ids_by_variant[variant_id] = ids
    return variants, ids_by_variant


def object_type_variants(ocel_db: OCELDb, object_type: str) -> ObjectTypeVariants:
    variants, _ = _variants_with_ids(ocel_db, object_type)
    return ObjectTypeVariants(
        variants=variants,
        case_count=sum(variant.case_count for variant in variants),
        event_count=sum(
            variant.event_count * variant.case_count for variant in variants
        ),
    )


def object_ids_for_variants(
    ocel_db: OCELDb, object_type: str, variant_ids: list[str]
) -> list[str]:
    """The ids of the objects belonging to any of the given variant ids."""
    _, ids_by_variant = _variants_with_ids(ocel_db, object_type)
    wanted = set(variant_ids)
    return [oid for vid in wanted for oid in ids_by_variant.get(vid, [])]
