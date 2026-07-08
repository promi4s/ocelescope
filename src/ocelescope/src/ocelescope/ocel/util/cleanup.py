from __future__ import annotations

from typing import Mapping

import pandas as pd

from ocelescope.ocel.constants.pm4py import EID_COL, OID_COL

_O2O_SOURCE_COL = OID_COL
_O2O_TARGET_COL = "ocel:oid_2"


def clean_ocel(ocel_dfs: Mapping[str, pd.DataFrame]) -> dict[str, pd.DataFrame]:
    """Drop dangling references and orphaned rows from an OCEL dataframe dict.

    Removes e2o relations pointing at a missing event or object, o2o
    relations pointing at a missing object, objects with no remaining e2o
    or o2o relation, events with no remaining e2o relation, and
    object_changes rows for objects that no longer exist.

    Boolean-mask indexing already yields fresh copies, so the returned dict
    holds tables independent of the inputs.
    """
    events_df = ocel_dfs["events"]
    objects_df = ocel_dfs["objects"]
    relations_df = ocel_dfs["relations"]
    o2o_df = ocel_dfs["o2o"]
    changes_df = ocel_dfs["object_changes"]

    # Step 1: drop e2o relations whose event or object id isn't present in
    # the events/objects tables.
    relations_df = relations_df.loc[
        relations_df[EID_COL].isin(events_df[EID_COL])
        & relations_df[OID_COL].isin(objects_df[OID_COL])
    ]

    # Step 2: drop o2o relations where either side references an object
    # id that isn't in the objects table.
    o2o_df = o2o_df.loc[
        o2o_df[_O2O_SOURCE_COL].isin(objects_df[OID_COL])
        & o2o_df[_O2O_TARGET_COL].isin(objects_df[OID_COL])
    ]

    # Step 3: keep only objects that participate in at least one surviving
    # relation, either as an e2o target or as either side of an o2o link.
    objects_df = objects_df.loc[
        objects_df[OID_COL].isin(relations_df[OID_COL])
        | objects_df[OID_COL].isin(o2o_df[_O2O_SOURCE_COL])
        | objects_df[OID_COL].isin(o2o_df[_O2O_TARGET_COL])
    ]

    # Step 4: drop object_changes rows for objects that no longer exist
    # (either they never did, or step 3 just pruned them).
    changes_df = changes_df.loc[changes_df[OID_COL].isin(objects_df[OID_COL])]

    # Step 5: keep only events that still have at least one surviving e2o
    # relation pointing at a (now guaranteed valid) object.
    events_df = events_df.loc[events_df[EID_COL].isin(relations_df[EID_COL])]

    return {
        "events": events_df,
        "objects": objects_df,
        "relations": relations_df,
        "o2o": o2o_df,
        "object_changes": changes_df,
    }
