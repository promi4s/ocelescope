from __future__ import annotations

from typing import Mapping

import polars as pl
from polars import DataFrame, LazyFrame

from ocelescope.ocel.constants.pm4py import (
    E2O_EVENT_ID,
    E2O_OBJECT_ID,
    EID_COL,
    OID_COL,
)

_O2O_SOURCE_COL = OID_COL
_O2O_TARGET_COL = "ocel:oid_2"


def _lazy(frame: DataFrame | LazyFrame) -> LazyFrame:
    """Normalize an eager or lazy frame to a LazyFrame."""
    return frame if isinstance(frame, LazyFrame) else frame.lazy()


def clean_ocel(ocel_dfs: Mapping[str, DataFrame | LazyFrame]) -> dict[str, DataFrame]:
    """Drop dangling references and orphaned rows from an OCEL dataframe dict.

    Removes e2o relations pointing at a missing event or object, o2o
    relations pointing at a missing object, objects with no remaining e2o
    or o2o relation, events with no remaining e2o relation, and
    object_changes rows for objects that no longer exist.

    Accepts eager ``DataFrame``s or lazy ``LazyFrame``s (the latter let any
    upstream filters push into the scan). The integrity pruning runs lazily and
    the five tables are materialized together in a single optimized
    ``collect_all`` pass, so the returned dict always holds eager ``DataFrame``s.
    """
    objects_df = _lazy(ocel_dfs["objects"])
    events_df = _lazy(ocel_dfs["events"])
    relations_df = _lazy(ocel_dfs["relations"])
    o2o_df = _lazy(ocel_dfs["o2o"])
    changes_df = _lazy(ocel_dfs["object_changes"])

    # Step 1: drop e2o relations whose event or object id isn't present in
    # the events/objects tables.
    relations_df = relations_df.join(
        events_df.select(pl.col(EID_COL).alias(E2O_EVENT_ID)).unique(),
        on=E2O_EVENT_ID,
        how="semi",
    ).join(
        objects_df.select(pl.col(OID_COL).alias(E2O_OBJECT_ID)).unique(),
        on=E2O_OBJECT_ID,
        how="semi",
    )

    # Step 2: drop o2o relations where either side references an object
    # id that isn't in the objects table.
    valid_object_ids = objects_df.select(pl.col(OID_COL)).unique()

    o2o_df = o2o_df.join(
        valid_object_ids.rename({OID_COL: _O2O_SOURCE_COL}),
        on=_O2O_SOURCE_COL,
        how="semi",
    ).join(
        valid_object_ids.rename({OID_COL: _O2O_TARGET_COL}),
        on=_O2O_TARGET_COL,
        how="semi",
    )

    # Step 3: keep only objects that participate in at least one
    # surviving relation, either as an e2o target or as either side of an
    # o2o link.
    objects_in_use = pl.concat(
        [
            relations_df.select(pl.col(E2O_OBJECT_ID).alias(OID_COL)),
            o2o_df.select(pl.col(_O2O_SOURCE_COL).alias(OID_COL)),
            o2o_df.select(pl.col(_O2O_TARGET_COL).alias(OID_COL)),
        ]
    ).unique()

    objects_df = objects_df.join(objects_in_use, on=OID_COL, how="semi")

    # Step 4: drop object_changes rows for objects that no longer
    # exist (either they never did, or step 3 just pruned them).
    changes_df = changes_df.join(
        objects_df.select(pl.col(OID_COL)).unique(), on=OID_COL, how="semi"
    )

    # Step 5: keep only events that still have at least one surviving
    # e2o relation pointing at a (now guaranteed valid) object.
    events_df = events_df.join(
        relations_df.select(pl.col(E2O_EVENT_ID).alias(EID_COL)).unique(),
        on=EID_COL,
        how="semi",
    )

    events_df, objects_df, relations_df, o2o_df, changes_df = pl.collect_all(
        [events_df, objects_df, relations_df, o2o_df, changes_df]
    )

    return {
        "events": events_df,
        "objects": objects_df,
        "relations": relations_df,
        "o2o": o2o_df,
        "object_changes": changes_df,
    }
