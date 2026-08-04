from pathlib import Path
from typing import TYPE_CHECKING

import pm4py
import polars as pl
import r4pm

from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    E2O_QUALIFIER,
    EID_COL,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.ocel.filter.filters.entity_type import ObjectTypeFilter

if TYPE_CHECKING:
    from ocelescope.ocel.core.ocel import OCEL


RENAME_MAP = {
    "case:concept:name": OID_COL,
    "concept:name": ACTIVITY_COL,
    "time:timestamp": TIMESTAMP_COL,
    f"case:{OTYPE_COL}": OTYPE_COL,
}


def create_ocel_from_xml(path: str, fallback_object_name: str = "LogObject") -> "OCEL":
    from ocelescope.ocel.core.ocel import OCEL

    log, _meta = r4pm.df.import_xes(path)

    log = log.rename({**RENAME_MAP}, strict=False)

    global_cols = [col.removeprefix("case:") for col in log.columns if col.startswith("case:")]

    event_cols = [
        col
        for col in log.columns
        if not col.startswith("case:")
        and col not in (EID_COL, OID_COL, ACTIVITY_COL, TIMESTAMP_COL, OTYPE_COL)
    ]

    log = log.with_columns(
        pl.col(col).cast(pl.String) for col in (OID_COL, EID_COL) if col in log.columns
    )

    if OTYPE_COL not in log.columns:
        log = log.with_columns(pl.lit(fallback_object_name).alias(OTYPE_COL))
    elif fallback_object_name is not None:
        log = log.with_columns(pl.col(OTYPE_COL).fill_null(fallback_object_name))

    if EID_COL not in log.columns:
        log = log.with_row_index(EID_COL).with_columns(
            (
                pl.col(ACTIVITY_COL)
                .str.to_lowercase()
                .str.strip_chars()
                .str.replace_all(r"[-\s]+", "_")
                + pl.lit("_")
                + pl.col(EID_COL).cast(pl.String)
            ).alias(EID_COL)
        )

    object_table = (
        log.select([f"case:{col}" for col in global_cols] + [OTYPE_COL, OID_COL])
        .unique(subset=[OID_COL])
        .rename({f"case:{col}": col for col in global_cols})
    )

    event_table = log.select(event_cols + [EID_COL, ACTIVITY_COL, TIMESTAMP_COL]).unique(
        subset=[EID_COL]
    )

    e2o_table = log.select([EID_COL, OTYPE_COL, ACTIVITY_COL, OID_COL, TIMESTAMP_COL]).with_columns(
        pl.lit(None, dtype=pl.String).alias(E2O_QUALIFIER)
    )

    return OCEL.from_frames(
        events=event_table,
        objects=object_table,
        relations=e2o_table,
    )


def write_ocel_to_xes(ocel: "OCEL", object_type: str, path: str | Path):
    with ocel.filter(
        [ObjectTypeFilter(object_types=[object_type], mode="include")]
    ) as filtered_ocel:
        latest_states = (
            filtered_ocel.objects.attribute_states()
            .df()
            .sort_values([TIMESTAMP_COL, OID_COL])
            .drop_duplicates([OID_COL], keep="last")
            .drop(columns=[TIMESTAMP_COL, OTYPE_COL])
            .set_index(OID_COL)
        )
        export_ocel = filtered_ocel.ocel
        export_objects = export_ocel.objects.set_index(OID_COL)
        export_objects.update(latest_states)
        export_ocel.objects = export_objects.reset_index()

        pm4py.write_xes(
            pm4py.ocel_flattening(export_ocel, object_type),
            str(path),
            variant_str="r4pm/rustxes",
        )
