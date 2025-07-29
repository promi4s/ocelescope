from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from typing import TYPE_CHECKING, Iterable, Sequence

import numpy as np
import pandas as pd
from pm4py.objects.ocel.obj import OCEL

if TYPE_CHECKING:
    from ocel.ocel_wrapper import OCELWrapper


def add_object_order(
    df: pd.DataFrame,
    /,
    otype_order: Sequence[str] | None = None,
    *,
    suffixes: tuple[str, ...] | None = None,
    prepend: tuple[pd.Series | np.ndarray | None, ...] | pd.Series | None = None,
) -> None:
    """Adds a column to an object DataFrame to use as canonical order.
    Objects are ordered by a specified object type order, and then by the object ID.
    Optionally, a superior order can be passed via the `prepend` parameter.
    Does not sort the DataFrame."""
    if suffixes is None:
        # Try to automatically detect the object column(s)
        if {"ocel:oid", "ocel:type"}.issubset(df.columns):
            suffixes = ("",)
        elif {"ocel:oid_1", "ocel:type_1", "ocel:oid_2", "ocel:type_2"}.issubset(
            df.columns
        ):
            suffixes = ("_1", "_2")
        else:
            raise ValueError

    if otype_order is None:
        otype_cols = [f"ocel:type{s}" for s in suffixes]
        otype_order = list(sorted(set().union(*[df[col] for col in otype_cols])))

    if isinstance(prepend, pd.Series | np.ndarray):
        prepend = tuple(prepend)
    if prepend:
        assert len(prepend) == len(suffixes)
    else:
        prepend = tuple(None for _ in suffixes)
    has_prepended_order = all(pre is not None for pre in prepend)

    otype_order_index = dict((ot, i) for i, ot in enumerate(otype_order))
    for suffix, pre in zip(suffixes, prepend):
        assert {f"ocel:type{suffix}", f"ocel:oid{suffix}"}.issubset(df.columns)
        otype_ix = df[f"ocel:type{suffix}"].map(otype_order_index)  # type: ignore
        df[f"obj_order{suffix}"] = list(
            zip(
                *([pre] if has_prepended_order and pre is not None else []),
                otype_ix,
                df[f"ocel:oid{suffix}"],
            )
        )  # type: ignore


def filter_activity(
    df: pd.DataFrame,
    /,
    activity_filter: str | set[str] | None,
    *,
    negative: bool = False,
) -> pd.DataFrame:
    """Filters a DataFrame w.r.t. an activity."""
    assert "ocel:activity" in df.columns
    if activity_filter is None:
        return df if not negative else df.iloc[0:0]
    if isinstance(activity_filter, str):
        predicate = df["ocel:activity"] == activity_filter
    elif isinstance(activity_filter, set):
        predicate = df["ocel:activity"].isin(activity_filter)  # type: ignore
    else:
        raise ValueError
    if negative:
        predicate = ~predicate
    return df[predicate]  # type: ignore


def filter_pm4py_ocel(
    ocel: OCEL,
    otypes: list[str] | None = None,
    oids: list[str] | None = None,
    activities: list[str] | None = None,
    qualifiers: list[str] | None = None,
    min_timestamp: datetime | None = None,
    max_timestamp: datetime | None = None,
):
    """
    Filters a pm4py OCEL by object types, activities, qualifies, and/or timestamps.
    Returns a minimal OCEL, deleting objects not related to any retained events and vice versa.
    In dynamic attributes, when passing min_timestamp, additionally retains the last value set before min_timestamp.
    """

    # relations      [ocel:eid, ocel:oid, ocel:qualifier, ocel:activity, ocel:timestamp, ocel:type]
    # events         [ocel:eid, ocel:timestamp, ocel:activity]
    # objects        [ocel:oid, ocel:type]
    # object_changes [ocel:oid, ocel:timestamp, ocel:field, ocel:type]
    # o2o            [ocel:oid, ocel:oid_2, ocel:qualifier]
    # e2e            [ocel:eid, ocel:eid_2, ocel:qualifier]

    def qualifier_filter(df: pd.DataFrame, col: str = "ocel:qualifier"):
        if qualifiers:
            return df[col].isin(qualifiers)
        return df[col].map(lambda x: True)

    ocel2 = deepcopy(ocel)

    # E2O relations table
    relations_filter = ocel2.relations["ocel:eid"].map(lambda x: True)
    if otypes:
        relations_filter = relations_filter & ocel2.relations["ocel:type"].isin(otypes)
    if oids:
        relations_filter = relations_filter & ocel2.relations["ocel:oid"].isin(oids)
    if activities:
        relations_filter = relations_filter & ocel2.relations["ocel:activity"].isin(
            activities
        )
    if qualifiers:
        relations_filter = relations_filter & ocel2.relations["ocel:qualifier"].isin(
            qualifiers
        )
    if min_timestamp is not None:
        relations_filter = relations_filter & (
            ocel2.relations["ocel:timestamp"] >= min_timestamp
        )
    if max_timestamp is not None:
        relations_filter = relations_filter & (
            ocel2.relations["ocel:timestamp"] <= max_timestamp
        )
    ocel2.relations = ocel2.relations[relations_filter]

    # Retain events & objects that have E2O relations
    ocel2.events = ocel2.events[
        ocel2.events["ocel:eid"].isin(ocel2.relations["ocel:eid"])  # type: ignore
    ]
    ocel2.objects = ocel2.objects[
        ocel2.objects["ocel:oid"].isin(ocel2.relations["ocel:oid"])  # type: ignore
    ]

    # object_changes table
    ocel2.object_changes = ocel2.object_changes[
        ocel2.object_changes["ocel:oid"].isin(ocel2.objects["ocel:oid"])  # type: ignore
    ]
    if max_timestamp is not None:
        ocel2.object_changes = ocel2.object_changes[
            ocel2.object_changes["ocel:timestamp"] <= max_timestamp
        ]
    if min_timestamp is not None:
        # Include the latest values of each attribute that were set before min_timestamp
        min_timestamp_filter = ocel2.object_changes["ocel:timestamp"] >= min_timestamp
        filtered = ocel2.object_changes[min_timestamp_filter]
        before = ocel2.object_changes[~min_timestamp_filter].sort_values(  # type: ignore
            "ocel:timestamp"
        )
        latest_before = before.groupby(
            ["ocel:oid", "ocel:field"], as_index=False
        ).last()
        ocel2.object_changes = pd.concat([latest_before, filtered])  # type: ignore

    # O2O relations table
    o2o_oid = ocel2.o2o["ocel:oid"].isin(ocel2.objects["ocel:oid"])  # type: ignore
    o2o_oid_2 = ocel2.o2o["ocel:oid_2"].isin(ocel2.objects["ocel:oid"])  # type: ignore
    ocel2.o2o = ocel2.o2o[o2o_oid & o2o_oid_2 & qualifier_filter(ocel2.o2o)][
        ocel2.o2o.columns
    ]

    # E2E relations table
    e2e_eid = ocel2.e2e["ocel:eid"].isin(ocel2.events["ocel:eid"])  # type: ignore
    e2e_eid_2 = ocel2.e2e["ocel:eid"].isin(ocel2.events["ocel:eid"])  # type: ignore
    ocel2.e2e = ocel2.e2e[e2e_eid & e2e_eid_2 & qualifier_filter(ocel2.e2e)][
        ocel2.e2e.columns
    ]

    return ocel2


def filter_relations(
    ocel: OCELWrapper | None = None,
    relations: pd.DataFrame | None = None,
    otype: str | None = None,
    otypes: Iterable[str] | None = None,
    activity: str | None = None,
    activities: Iterable[str] | None = None,
    qualifier: str | None = None,
    qualifiers: Iterable[str] | None = None,
    copy: bool = True,
) -> pd.DataFrame:
    """
    Filters an E2O relation DataFrame by the given object type(s), activity(s) and/or qualifier(s).
    """
    if relations is None and ocel is not None:
        relations = ocel.relations
    if relations is None:
        raise ValueError("filter_relations(): Pass either ocel or relations.")
    if (
        (otype is not None and otypes is not None)
        or (activity is not None and activities is not None)
        or (qualifier is not None and qualifiers is not None)
    ):
        raise ValueError(
            "filter_relations(): For otype, activity and qualifier, pass either a single value or a list."
        )

    filter = True
    if otype:
        filter = filter & (relations["ocel:type"] == otype)
    if otypes:
        filter = filter & (relations["ocel:type"].isin(otypes))  # type: ignore
    if activity:
        filter = filter & (relations["ocel:activity"] == activity)
    if activities:
        filter = filter & (relations["ocel:activity"].isin(activities))  # type: ignore
    if qualifier:
        filter = filter & (relations["ocel:qualifier"] == qualifier)
    if qualifiers:
        filter = filter & (relations["ocel:qualifier"].isin(qualifiers))  # type: ignore
    if filter is not True:
        relations = relations[filter]  # type: ignore
    if copy:
        return relations.copy()  # type: ignore
    return relations  # type: ignore
