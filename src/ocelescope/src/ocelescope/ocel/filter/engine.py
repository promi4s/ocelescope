from typing import TYPE_CHECKING, Sequence

from ocelescope.ocel.constants.pm4py import O2O_SOURCE_ID, O2O_TARGET_ID
from ocelescope.ocel.filter.base import BaseFilter, FilterResult
from ocelescope.ocel.util.integrity import clean_ocel

if TYPE_CHECKING:
    from ocelescope.ocel.core.ocel import OCEL


def compute_combined_masks(ocel: "OCEL", filters: Sequence[BaseFilter]) -> FilterResult:
    """Run every filter against `ocel` and AND-merge their masks together.

    Starts from an empty `FilterResult` rather than seeding all-True masks:
    `and_merge` already falls through to whichever side is non-None, so a
    table that no filter touches just stays `None` (no filtering applied)
    without ever materializing a dummy mask for it.
    """
    combined = FilterResult()

    for filter in filters:
        combined = combined.and_merge(filter.filter(ocel))

    return combined


def apply_filters(ocel: "OCEL", filters: Sequence[BaseFilter]) -> "OCEL":
    """
    Apply a sequence of filters to `ocel` and return a new, integrity-clean OCEL.

    Each filter contributes a boolean mask (pandas or polars) over events,
    objects, e2o relations, and/or o2o relations; the masks are AND-merged
    (normalized to polars, the OCEL's native storage type) and applied
    directly to the polars tables (no PM4PY filter functions involved, and
    no pandas round-trip). `clean_ocel` then drops any rows that became
    dangling as a result.
    """
    from ocelescope.ocel.core.ocel import OCEL

    masks = compute_combined_masks(ocel, filters)

    events_pl = ocel.events.pl if masks.events is None else ocel.events.pl.filter(masks.events)
    objects_pl = ocel.objects.pl if masks.objects is None else ocel.objects.pl.filter(masks.objects)
    relations_pl = ocel.e2o.pl if masks.e2o is None else ocel.e2o.pl.filter(masks.e2o)
    o2o_pl = ocel.o2o.pl if masks.o2o is None else ocel.o2o.pl.filter(masks.o2o)

    # o2o is stored under canonical column names (O2O_SOURCE_ID/O2O_TARGET_ID);
    # clean_ocel expects PM4PY's raw names, same rename r4pm_dict applies.
    o2o_pl = o2o_pl.rename({O2O_SOURCE_ID: "ocel:oid", O2O_TARGET_ID: "ocel:oid_2"})

    # All tables stay lazy here; clean_ocel pushes the filters into the scans
    # and materializes the cleaned result in one collect_all pass.
    ocel_dict = clean_ocel(
        {
            "events": events_pl,
            "objects": objects_pl,
            "object_changes": ocel.objects.changes_pl,
            "relations": relations_pl,
            "o2o": o2o_pl,
        }
    )

    return OCEL(
        ocel=ocel_dict,
        meta=ocel.meta,
        quantityExtension=(
            (ocel.quantities.oqty, ocel.quantities.qop, ocel.quantities.properties)
            if ocel.quantities.is_populated()
            else None
        ),
    )
