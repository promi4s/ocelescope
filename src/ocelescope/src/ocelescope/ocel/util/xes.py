import orjson
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

RENAME_MAP = {
    "case:concept:name": OID_COL,
    "concept:name": ACTIVITY_COL,
    "time:timestamp": TIMESTAMP_COL,
    f"case:{OTYPE_COL}": OTYPE_COL,
}

SPECIAL_NAMES = ["concept:name", "time:timestamp", OTYPE_COL]


def create_ocel_from_xml(path: str, fallback_object_name: str = "LogObject") -> pm4py.OCEL:

    log, meta = r4pm.df.import_xes(path)

    meta = orjson.loads(meta)

    global_cols = [
        attr["key"] for attr in meta.get("global_trace_attrs") if attr["key"] not in SPECIAL_NAMES
    ]

    event_cols = [
        attr["key"] for attr in meta.get("global_event_attrs") if attr["key"] not in SPECIAL_NAMES
    ]

    log = log.rename({**RENAME_MAP}, strict=False)

    if OTYPE_COL not in log.columns:
        log = log.with_columns(pl.lit(fallback_object_name).alias(OTYPE_COL))
    elif fallback_object_name is not None:
        log = log.with_columns(pl.col(OTYPE_COL).fill_null(fallback_object_name))

    if EID_COL not in event_cols:
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

    event_table = log.select(event_cols + [EID_COL, ACTIVITY_COL, TIMESTAMP_COL])

    e2o_table = log.select([EID_COL, OTYPE_COL, ACTIVITY_COL, OID_COL, TIMESTAMP_COL]).with_columns(
        pl.lit(None, dtype=pl.String).alias(E2O_QUALIFIER)
    )

    return pm4py.OCEL(
        events=event_table.to_pandas(),
        objects=object_table.to_pandas(),
        relations=e2o_table.to_pandas(),
    )
