"""Quantity-extension info, computed in DuckDB.

Mirrors the ``QuantityManager``: rows with a zero ``qel:quantity`` are dropped
(null is kept, matching the pandas ``.ne(0)`` mask); item types / objects come from
both the initial quantities and the operations, events from the operations, and the
object types / activities are the types of the involved objects / events.
"""

from __future__ import annotations

from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, EID_COL, OID_COL, OTYPE_COL
from ocelescope.ocel.constants.quantity import QEL_ITEM_TYPE, QEL_QUANTITY

from ocelescope import OCEL

from ocelescope_module_ocel.models import QuantityInfo

_CLEAN = f'("{QEL_QUANTITY}" != 0 OR "{QEL_QUANTITY}" IS NULL)'


def quantity_info(ocel: OCEL) -> QuantityInfo:
    has_quantities = ocel.quantities.has_quantities
    has_operations = ocel.quantities.has_operations
    if not has_quantities and not has_operations:
        return QuantityInfo(
            item_types=[],
            total_object_count=0,
            total_event_count=0,
            object_types=[],
            activities=[],
        )

    def cleaned_union(column: str, *, operations_only: bool = False) -> str:
        tables = []
        if has_quantities and not operations_only:
            tables.append("quantities")
        if has_operations:
            tables.append("quantity_operations")
        return " UNION ALL ".join(
            f'SELECT "{column}" FROM {table} WHERE {_CLEAN}' for table in tables
        )

    def distinct(column: str, *, operations_only: bool = False) -> list[str]:
        union = cleaned_union(column, operations_only=operations_only)
        if not union:
            return []
        rows = ocel.sql(
            f'SELECT DISTINCT "{column}" FROM ({union}) WHERE "{column}" IS NOT NULL'
        ).fetchall()
        return [row[0] for row in rows]

    object_ids = distinct(OID_COL)
    event_ids = distinct(EID_COL, operations_only=True)

    object_union = cleaned_union(OID_COL)
    object_types = (
        [
            row[0]
            for row in ocel.sql(
                f'SELECT DISTINCT "{OTYPE_COL}" FROM objects '
                f'WHERE "{OID_COL}" IN ('
                f'SELECT "{OID_COL}" FROM ({object_union}) '
                f'WHERE "{OID_COL}" IS NOT NULL)'
            ).fetchall()
        ]
        if object_ids
        else []
    )

    event_union = cleaned_union(EID_COL, operations_only=True)
    activities = (
        [
            row[0]
            for row in ocel.sql(
                f'SELECT DISTINCT "{ACTIVITY_COL}" FROM events '
                f'WHERE "{EID_COL}" IN ('
                f'SELECT "{EID_COL}" FROM ({event_union}) '
                f'WHERE "{EID_COL}" IS NOT NULL)'
            ).fetchall()
        ]
        if event_ids
        else []
    )

    return QuantityInfo(
        item_types=distinct(QEL_ITEM_TYPE),
        total_object_count=len(object_ids),
        total_event_count=len(event_ids),
        object_types=object_types,
        activities=activities,
    )
