from __future__ import annotations

from dataclasses import dataclass
import platform
import sys
from uuid import uuid4
import warnings
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Any, Iterable, Literal, Optional

import networkx as nx
import numpy as np
import pandas as pd
import pm4py
from cachetools import LRUCache
from pm4py.objects.ocel.obj import OCEL

from api.extensions import (
    OcelExtension,
    get_registered_extensions,
)
from api.logger import logger
from lib.attributes import (
    AttributeSummary,
    summarize_event_attributes,
    summarize_object_attributes,
)
from lib.relations import summarize_e2o_counts, summarize_o2o_counts
from ocel.utils import add_object_order, filter_relations
from util.cache import instance_lru_cache
from util.pandas import mirror_dataframe, mmmm
from util.types import PathLike

from filters import FilterConfig, apply_filters


class OCELWrapper:
    def __init__(self, ocel: OCEL, id: Optional[str] = None):
        self._id = id if id is not None else str(uuid4())

        self.ocel = ocel
        # Metadata, to be set manually after creating the instance
        self.meta: dict[str, Any] = {}
        self._cache_info = {}

        # Used to distinguish multiple ocels with the same id but one is filtered form
        self.state_id = str(uuid4())

        # extensions
        self._extensions: dict[str, OcelExtension] = {}

        self._init_cache()

    def _init_cache(self):
        # Instance-level cache object (using cachetools)
        self.cache = LRUCache(maxsize=128)
        self.cache_lock = Lock()

    @property
    def id(self) -> str:
        return self._id

    # ----- Pm4py Aliases ------------------------------------------------------------------------------------------
    # region

    @property
    def events(self):
        return self.ocel.events

    @property
    def objects(self):
        return self.ocel.objects

    @property
    def object_changes(self):
        return self.ocel.object_changes

    @property
    def relations(self):
        return self.ocel.relations

    # endregion
    # ----- BASIC PROPERTIES / STATS ------------------------------------------------------------------------------------------
    # region

    @property
    @instance_lru_cache()
    def activities(self) -> list[str]:
        return list(sorted(self.ocel.events["ocel:activity"].unique().tolist()))

    @property
    @instance_lru_cache()
    def activity_counts(self) -> pd.Series:
        return self.ocel.events["ocel:activity"].value_counts()

    @property
    @instance_lru_cache()
    def object_types(self) -> list[str]:
        return list(sorted(self.ocel.objects["ocel:type"].unique().tolist()))

    @property
    def otypes(self) -> list[str]:
        """Alias for object_types"""
        return self.object_types

    @property
    @instance_lru_cache()
    def otype_counts(self) -> pd.Series:
        return self.ocel.objects["ocel:type"].value_counts()

    @property
    @instance_lru_cache()
    def objects_with_otypes(
        self,
    ) -> pd.Series:
        """pandas Series containing the object type of each object"""
        return self.ocel.objects[["ocel:oid", "ocel:type"]].set_index("ocel:oid")[  # type: ignore
            "ocel:type"
        ]

    @property
    @instance_lru_cache()
    def events_with_activities(self) -> pd.Series:
        """pandas Series containing the activity of each event"""
        return self.ocel.events[["ocel:eid", "ocel:activity"]].set_index("ocel:eid")[  # type: ignore
            "ocel:activity"
        ]

    @property
    def obj_otypes(self) -> pd.Series:
        """Alias for objects_with_otypes"""
        return self.objects_with_otypes

    @property
    def event_activities(self) -> pd.Series:
        """Alias for events_with_activities"""
        return self.events_with_activities

    def has_object_types(self, otypes: Iterable[str]) -> bool:
        return all(ot in self.otypes for ot in otypes)

    def has_activities(self, activities: Iterable[str]) -> bool:
        return all(act in self.activities for act in activities)

    # endregion

    # ----- Filtering ------------------------------------------------------------------------------------------
    # region

    def apply_filter(self, filters: list[FilterConfig]) -> OCELWrapper:
        filtered_ocel = OCELWrapper(
            apply_filters(self.ocel, filters=filters),
            id=self.id,
        )
        filtered_ocel.meta = self.meta

        return filtered_ocel

    # endregion
    # ----- PROCESS DISCOVERY ------------------------------------------------------------------------------------------
    # region

    @instance_lru_cache(make_hashable=True)
    def ocpn(
        self,
        otypes: set[str] | None = None,
        inductive_miner_variant: Literal["im", "imd"] = "im",
        diagnostics_with_tbr: bool = False,
    ) -> dict[str, Any]:
        """
        Discovers an Object-centric Petri Net (OCPN), filtering for a given list of object types.
        Uses a custom cache, able to save multiple OCPNs for different object type sets.

        Wrapper for pm4py's OCPN discovery method (pm4py.discover_oc_petri_net)
        """
        # Complete parameters
        if otypes is None:
            otypes = set(self.otypes)
        sorted_otypes = sorted([ot for ot in otypes if ot in self.otypes])
        if not sorted_otypes:
            raise ValueError(
                "OCPN Discovery received invalid or empty object type set."
            )

        # Discover OCPN
        # TODO might use own filter function
        filtered_ocel = pm4py.filter_ocel_object_types(self.ocel, sorted_otypes)
        ocpn = pm4py.discover_oc_petri_net(
            filtered_ocel,
            inductive_miner_variant=inductive_miner_variant,
            diagnostics_with_tbr=diagnostics_with_tbr,
        )

        return ocpn

    @instance_lru_cache()
    def flatten(self, otype: str) -> pd.DataFrame:
        if otype not in self.otypes:
            raise ValueError(f"Object type '{otype}' not found")
        return pm4py.ocel.ocel_flattening(ocel=self.ocel, object_type=otype)

    @instance_lru_cache()
    def directly_follows_graph(self, otype: str) -> dict[tuple[str, str], int]:
        dfg, _, _ = pm4py.discovery.discover_directly_follows_graph(self.flatten(otype))
        return dfg

    def dfg(self, otype: str):
        """Alias of directly_follows_graph"""
        return self.directly_follows_graph(otype)

    @instance_lru_cache()
    def eventually_follows_graph(self, otype: str) -> set[tuple[str, str]]:
        """Discovers the eventually-follows graph of the flattened log, without frequencies."""
        dfg = self.directly_follows_graph(otype=otype)
        DFG = nx.DiGraph()
        DFG.add_edges_from(dfg.keys())
        EFG = nx.transitive_closure(DFG)

        # Output graph as edge set
        # efg = {u: set(EFG.successors(u)) for u in EFG.nodes() if EFG.out_degree(u)}
        efg = set(EFG.edges())
        return efg

    def efg(self, otype: str):
        """Alias of eventually_follows_graph"""
        return self.eventually_follows_graph(otype)

    # endregion

    # ----- OBJECT INTERACTIONS ------------------------------------------------------------------------------------------
    # region

    @instance_lru_cache(make_hashable=True)
    def object_relations(
        self,
        /,
        otype1_filter: set[str] | None = None,
        otype2_filter: set[str] | None = None,
        oid1_filter: set[str] | None = None,
        oid2_filter: set[str] | None = None,
        *,
        name1: str | None = None,
        name2: str | None = None,
        include_interactions: bool = True,
        include_frequencies: bool = True,
        include_o2o: bool = False,
        include_o2o_qualifiers: bool = True,
        remove_otype_loops: bool = False,
        groupby_objects: bool = True,
        otype_order: list[str] | None = None,
        include_relation_type: bool = False,
    ) -> pd.DataFrame:
        """Returns a DataFrame with object relations. This includes
        - object interactions in shared events
        - O2O relations (when passing include_o2o=True). O2O relations are treated as undirected here!

        When passing groupby_objects=False, every row represents a single interaction, otherwise object pairs are grouped.
        By default, interaction frequencies are counted, and O2O qualifiers aggregated to a set.
        Objects belonging to both filters are ordered by their type and object id (the smaller one in ocel:oid_1, the bigger in ocel:oid_2).
        When passing include_relation_type=True, the column reltype contains either "interaction", "o2o", or "both".
        """
        if not include_o2o and not include_interactions:
            raise ValueError
        if not include_interactions:
            include_frequencies = False
        if not include_o2o:
            include_o2o_qualifiers = False
        if include_frequencies and not groupby_objects:
            raise ValueError
        if otype_order is None:
            otype_order = list(sorted(self.otypes))

        if otype1_filter_all := otype1_filter is None:
            otype1_filter = set(self.otypes)
        if otype2_filter_all := otype2_filter is None:
            otype2_filter = set(self.otypes)

        isempty = lambda f: f is not None and not f
        if isempty(otype1_filter) or isempty(oid1_filter):
            raise ValueError("Empty filter in object_relations (otype1/oid1)")
        if isempty(otype2_filter) or isempty(oid2_filter):
            raise ValueError("Empty filter in object_relations (otype2/oid2)")

        if include_interactions:
            relations = self.ocel.relations[["ocel:eid", "ocel:oid", "ocel:type"]]

            # Init relations1 (left side)
            if not otype1_filter_all:
                relations1 = relations[relations["ocel:type"].isin(otype1_filter)]  # type: ignore
            else:
                relations1 = relations
            if oid1_filter is not None:
                relations1 = relations1[relations1["ocel:oid"].isin(oid1_filter)]  # type: ignore

            # Init relations2 (right side)
            if not otype2_filter_all:
                relations2 = relations[relations["ocel:type"].isin(otype2_filter)]  # type: ignore
            else:
                relations2 = relations
            if oid2_filter is not None:
                relations2 = relations2[relations2["ocel:oid"].isin(oid2_filter)]  # type: ignore

            assert otype1_filter and otype2_filter
            relations1 = relations1.drop_duplicates()  # type: ignore
            relations2 = relations2.drop_duplicates()  # type: ignore

            # Merge
            interactions = pd.merge(
                relations1, relations2, on="ocel:eid", suffixes=("_1", "_2")
            )
            ix = interactions["ocel:oid_1"] != interactions["ocel:oid_2"]
            if remove_otype_loops:
                ix = ix & (interactions["ocel:type_1"] != interactions["ocel:type_2"])
            interactions.drop(index=interactions.index[~ix], inplace=True)  # type: ignore

            if groupby_objects and not include_frequencies:
                interactions.drop_duplicates(
                    subset=["ocel:oid_1", "ocel:oid_2"], inplace=True
                )
        else:
            interactions = None

        # Add O2O relations
        if include_o2o:
            if not self.o2o.empty:
                # Mirror O2O relations
                o2o = pd.concat([self.o2o, mirror_dataframe(self.o2o)])
            else:
                # Empty O2O but need column names
                o2o = self.o2o.copy()

            # Ignore self-loops, but warn if they exist:
            if (self.o2o["ocel:oid_1"] == self.o2o["ocel:oid_2"]).any():
                num_self_loops = (
                    self.o2o["ocel:oid_1"] == self.o2o["ocel:oid_2"]
                ).sum()
                logger.warning(
                    f"object_relations currently not supporting O2O self-loops. Dropping {num_self_loops} relations."
                )
                o2o = o2o[o2o["ocel:oid_1"] != o2o["ocel:oid_2"]]

            if remove_otype_loops:
                o2o = o2o[o2o["ocel:type_1"] != o2o["ocel:type_2"]]

            # Apply otype filters
            o2o = o2o[
                o2o["ocel:type_1"].isin(otype1_filter)  # type: ignore
                & o2o["ocel:type_2"].isin(otype2_filter)  # type: ignore
            ]
            # Apply oid filters
            if oid1_filter is not None:
                o2o = o2o[o2o["ocel:oid_1"].isin(oid1_filter)]  # type: ignore
            if oid2_filter is not None:
                o2o = o2o[o2o["ocel:oid_2"].isin(oid2_filter)]  # type: ignore

            if include_o2o_qualifiers:
                o2o.rename(  # type: ignore
                    columns={"ocel:qualifier": "ocel:o2o_qualifier"},
                    inplace=True,
                )
            else:
                # No aggregation like counts etc. needed, use faster drop_duplicates instead of groupby
                o2o.drop_duplicates(subset=["ocel:oid_1", "ocel:oid_2"], inplace=True)  # type: ignore
                o2o.drop(columns=["ocel:qualifier"], inplace=True)  # type: ignore
        else:
            o2o = None

        if include_relation_type:
            if interactions is not None:
                interactions["reltype"] = "interaction"
            if o2o is not None:
                o2o["reltype"] = "o2o"
        if include_interactions and include_o2o:
            og = pd.concat([interactions, o2o])  # type: ignore
        elif include_interactions and interactions is not None:
            og = interactions
        elif include_o2o and o2o is not None:
            og = o2o
        else:
            raise ValueError

        common_otypes = otype1_filter.intersection(otype2_filter)
        if common_otypes:
            # Remove duplicate pair rows (with switched oid1/oid2 order)
            # Dedupe only needs to be handled when there are common_otypes.
            # The og DataFrame is currently mirrored (each relation represented 2 times)
            # Idea: use canonical ordering (add_object_order()), and overwrite this order in case an object type is just contained on one side.
            # -1: Force keep on left side. 0: Use canonical order. 1: Force keep on right side.
            if oid1_filter is None and oid2_filter is None:
                if len(common_otypes) == len(self.otypes):
                    # Canonical order is used for all pairs
                    prepend = None
                else:
                    # Add object order just considering otype filters
                    side_filter1_otype = np.where(
                        og["ocel:type_1"].isin(otype2_filter),  # type: ignore
                        0,
                        -1,
                    )
                    side_filter2_otype = np.where(
                        og["ocel:type_2"].isin(otype1_filter),  # type: ignore
                        0,
                        1,
                    )
                    prepend = (side_filter1_otype, side_filter2_otype)
            else:
                # New:
                # Add object order considering otype & oid filters
                side_filter1_otype = np.where(
                    og["ocel:type_1"].isin(otype2_filter),  # type: ignore
                    0,
                    -1,
                )
                side_filter2_otype = np.where(
                    og["ocel:type_2"].isin(otype1_filter),  # type: ignore
                    0,
                    1,
                )

                oids1 = oid1_filter or set(
                    self.objects[self.objects["ocel:type"].isin(otype1_filter)][  # type: ignore
                        "ocel:oid"
                    ]
                )
                oids2 = oid2_filter or set(
                    self.objects[self.objects["ocel:type"].isin(otype2_filter)][  # type: ignore
                        "ocel:oid"
                    ]
                )
                side_filter1_oid = np.where(
                    og["ocel:oid_1"].isin(oids2),  # type: ignore
                    0,
                    -1,
                )
                side_filter2_oid = np.where(
                    og["ocel:oid_2"].isin(oids1),  # type: ignore
                    0,
                    1,
                )
                prepend = (
                    2 * side_filter1_otype + side_filter1_oid,
                    2 * side_filter2_otype + side_filter2_oid,
                )

            add_object_order(og, otype_order, prepend=prepend)  # type: ignore
            # Just retain pairs where order1 < order2
            og = og[og["obj_order_1"] < og["obj_order_2"]]
            og.drop(columns=["obj_order_1", "obj_order_2"], inplace=True)  # type: ignore

        # Group by oids & count common events
        if groupby_objects:
            if (
                include_frequencies
                or include_o2o_qualifiers
                or (include_relation_type and include_interactions and include_o2o)
            ):
                # Need groupby & agg
                agg = {
                    "ocel:type_1": "first",
                    "ocel:type_2": "first",
                    # "obj_order_1": "first",
                    # "obj_order_2": "first",
                }
                if include_frequencies:
                    agg["ocel:eid"] = "count"
                if include_o2o_qualifiers:
                    agg["ocel:o2o_qualifier"] = "unique"
                if include_relation_type and include_interactions and include_o2o:
                    agg["reltype"] = (  # type: ignore
                        lambda types: types.iloc[0] if types.nunique() == 1 else "both"
                    )  # type: ignore
                og = (  # type: ignore
                    og.groupby(["ocel:oid_1", "ocel:oid_2"], as_index=False)  # type: ignore
                    .agg(agg)
                    .rename(columns={"ocel:eid": "freq"})
                )
            else:
                # No aggregation like counts etc. needed, use faster drop_duplicates instead of groupby
                og.drop_duplicates(subset=["ocel:oid_1", "ocel:oid_2"], inplace=True)  # type: ignore
            if include_o2o and include_o2o_qualifiers:
                og["ocel:o2o_qualifiers"] = og["ocel:o2o_qualifier"].apply(  # type: ignore
                    lambda qs: set(qs).difference({np.nan})
                )
                og.drop(columns=["ocel:o2o_qualifier"], inplace=True)  # type: ignore
            if not include_frequencies:
                og.drop(columns=["ocel:eid"], inplace=True, errors="ignore")  # type: ignore

        assert name1 is None or name2 is None or name1 != name2
        if name1 is not None:
            og.rename(  # type: ignore
                columns={
                    "ocel:oid_1": f"{name1}_oid",
                    "ocel:type_1": f"{name1}_type",
                },
                inplace=True,
            )
        if name2 is not None:
            og.rename(  # type: ignore
                columns={
                    "ocel:oid_2": f"{name2}_oid",
                    "ocel:type_2": f"{name2}_type",
                },
                inplace=True,
            )

        return og  # type: ignore

    @property
    @instance_lru_cache()
    def object_interaction_frequencies(self):
        return self.object_relations(
            include_frequencies=True,
            include_o2o=False,
        ).rename(columns={"freq": "num_events"})

    @property
    @instance_lru_cache()
    def object_interaction_graph(self) -> nx.Graph:
        return nx.from_pandas_edgelist(
            self.object_relations(
                include_frequencies=False,
                include_o2o=False,
            ),
            source="ocel:oid_1",
            target="ocel:oid_2",
        )

    # endregion

    # ----- EVENT-OBJECT GRAPH ------------------------------------------------------------------------------------------
    # region

    @instance_lru_cache(make_hashable=True)
    def successions(self, otypes: set[str] | None = None):
        relations = self.lifecycle_indices(otypes=otypes, include_qualifiers=False)
        relations["ocel:next_lifecycle_index"] = relations["ocel:lifecycle_index"] + 1
        relations = relations[
            [
                "ocel:oid",
                "ocel:type",
                "ocel:eid",
                "ocel:activity",
                "ocel:lifecycle_index",
                "ocel:next_lifecycle_index",
            ]
        ]
        succ = pd.merge(
            relations,
            relations,
            left_on=["ocel:oid", "ocel:type", "ocel:next_lifecycle_index"],
            right_on=["ocel:oid", "ocel:type", "ocel:lifecycle_index"],
            suffixes=("_1", "_2"),
        )
        succ.drop(
            columns=["ocel:next_lifecycle_index_1", "ocel:next_lifecycle_index_2"],
            inplace=True,
        )
        return succ

    # endregion

    # ----- O2O RELATIONS ------------------------------------------------------------------------------------------
    # region

    @property
    @instance_lru_cache()
    def o2o(self):
        """O2O relationships, with object types"""
        return self.join_otypes(
            self.ocel.o2o.rename(columns={"ocel:oid": "ocel:oid_1"})
        )

    @instance_lru_cache()
    def o2o_summary(self, direction: Optional[Literal["source", "target"]] = "source"):
        return summarize_o2o_counts(self.ocel, direction=direction)

    # endregion
    # ----- E2O RELATIONS ------------------------------------------------------------------------------------------
    # region

    @instance_lru_cache()
    def e2o_summary(self, direction: Optional[Literal["source", "target"]] = "source"):
        return summarize_e2o_counts(self.ocel, direction=direction)

    # endregion
    # ----- ATTRIBUTES ------------------------------------------------------------------------------------------
    # region
    @property
    def eattr_names(self) -> list[str]:
        return sorted(
            [col for col in self.ocel.events.columns if not col.startswith("ocel:")]
        )

    @property
    def oattr_names_static(self) -> list[str]:
        return sorted(
            [
                col
                for col in self.ocel.objects.columns[self.ocel.objects.count() > 0]
                if not col.startswith("ocel:")
            ]
        )

    @property
    def oattr_names_dynamic(self) -> list[str]:
        return sorted(
            [
                col
                for col in self.ocel.object_changes.columns[
                    self.ocel.object_changes.count() > 0
                ]
                if not col.startswith("ocel:") and col != "@@cumcount"
            ]
        )

    @property
    def oattr_names(self) -> list[str]:
        return sorted(set(self.oattr_names_static + self.oattr_names_dynamic))

    @property
    @instance_lru_cache()
    def object_attribute_summary(self) -> dict[str, list[AttributeSummary]]:
        return summarize_object_attributes(self.ocel)

    @property
    @instance_lru_cache()
    def event_attribute_summary(self) -> dict[str, list[AttributeSummary]]:
        return summarize_event_attributes(self.ocel)

    # endregion

    # ----- OBJECT LIFECYCLES, ACTIVITY ORDER ------------------------------------------------------------------------------------------
    # region

    @property
    @instance_lru_cache()
    def num_events_per_object(self):
        return self.join_otype(
            self.ocel.relations.groupby("ocel:oid")["ocel:eid"]
            .count()
            .rename("num_events")
            .reset_index()
        )

    @property
    @instance_lru_cache()
    def median_num_events_per_otype(self):
        return self.num_events_per_object.groupby("ocel:type")["num_events"].median()

    @instance_lru_cache()
    def sort_otypes(self) -> list[str]:
        """A sorted list of the object types. Object types are sorted by the median number of events per object."""
        return (
            self.median_num_events_per_otype.reset_index()
            .sort_values(["num_events", "ocel:type"])["ocel:type"]
            .tolist()
        )

    @instance_lru_cache(make_hashable=True)
    def lifecycle_indices(
        self, otypes: set[str] | None = None, include_qualifiers: bool = True
    ) -> pd.DataFrame:
        """
        Enriches E2O relations with the object lifecycle index (ocel:lifecycle_index).
        Duplicated E2O relations are grouped, with qualifiers aggregated to a set.
        """
        columns = [
            "ocel:eid",
            "ocel:activity",
            "ocel:timestamp",
            "ocel:oid",
            "ocel:type",
        ]
        if include_qualifiers:
            columns.append("ocel:qualifier")
        relations = self.filter_relations(otypes=otypes, copy=False)
        relations = relations[columns]
        if not include_qualifiers:
            relations = relations.drop_duplicates(subset=["ocel:eid", "ocel:oid"])
        elif not self.are_qualifiers_unique():
            # An e2o relation might be present multiple times because of multiple qualifiers.
            # Group these relations and retain the qualifiers in a set.
            # (Otherwise, lifecycle indices do not make sense - an event would be following itself.)
            e2o = relations.groupby(["ocel:eid", "ocel:oid"])
            relations = e2o[["ocel:activity", "ocel:timestamp", "ocel:type"]].first()
            relations["ocel:qualifiers"] = e2o["ocel:qualifier"].agg(set)
            relations = relations.reset_index()
        else:
            relations = relations.copy()
            relations["ocel:qualifiers"] = relations["ocel:qualifier"].apply(
                lambda q: {q}
            )
            relations.drop(columns=["ocel:qualifier"], inplace=True)
        # Compute lifecycle indices
        relations["ocel:lifecycle_index"] = (
            relations.sort_values(["ocel:oid", "ocel:timestamp"])
            .groupby("ocel:oid")
            .cumcount()
        )
        return relations

    # endregion

    # ----- E2O Relations ------------------------------------------------------------------------------------------
    # region

    @property
    @instance_lru_cache()
    def type_relations(self) -> pd.DataFrame:
        x: pd.Series = self.ocel.relations.groupby(
            ["ocel:activity", "ocel:type", "ocel:qualifier"]
        ).size()  # type: ignore
        return x.reset_index(name="freq")

    @property
    @instance_lru_cache()
    def type_relation_frequencies(self) -> pd.Series:
        return self.type_relations.groupby(["ocel:activity", "ocel:type"])["freq"].sum()

    @property
    @instance_lru_cache()
    def objects_per_event(self) -> pd.DataFrame:
        """Computes the number of objects per event, grouped by activity and object type, aggregated by mean, min, median, max."""
        # TODO nonzero does not work here. Due to the groupby calls, there are no zero entries, leading to nonzero being either 1 or NaN.
        type_relations: pd.DataFrame = (
            self.relations.groupby(
                ["ocel:eid", "ocel:activity", "ocel:type"], as_index=False
            )
            .size()
            .rename(columns={"size": "num_objects"})  # type: ignore
            .groupby(["ocel:activity", "ocel:type"], as_index=False)["num_objects"]
            .pipe(mmmm, nonzero=False, dtype=int)  # type: ignore
        )
        type_relations["always"] = np.where(
            type_relations["min"] == type_relations["max"],
            type_relations["min"],
            np.nan,
        )
        type_relations["unique"] = type_relations["max"] == 1
        type_relations["always_unique"] = type_relations["always"] == 1
        type_relation_stats = pd.pivot(
            type_relations,
            columns="ocel:type",
            index="ocel:activity",
            values=type_relations.columns[2:],  # type: ignore
        )  # type: ignore

        return type_relation_stats

    @property
    @instance_lru_cache()
    def objects_per_activity(self) -> pd.DataFrame:
        """Counts the number of objects of each type related to events of an activity.
        Returns a DataFrame with min/max number of objects per event and the (relative) number of events that have any object.
        Counts separately for different qualifiers.
        """
        event_otypes = (
            self.relations.groupby(
                ["ocel:eid", "ocel:type", "ocel:qualifier"], as_index=False
            )
            .agg({"ocel:oid": "size", "ocel:activity": "first"})
            .rename(columns={"ocel:oid": "num_objs"})
        )
        act_otype_counts = (
            event_otypes.groupby(
                ["ocel:activity", "ocel:type", "ocel:qualifier"], as_index=False
            )["num_objs"]
            .agg(["min", "max", "mean", np.count_nonzero])
            .rename(columns={"count_nonzero": "nonzero_abs"})
        )
        act_otype_counts = act_otype_counts.join(
            self.activity_counts.rename("num_events"), on="ocel:activity"
        )
        act_otype_counts["nonzero_rel"] = (
            act_otype_counts["nonzero_abs"] / act_otype_counts["num_events"]
        )
        return act_otype_counts

    def unique_objects_per_activity(
        self,
        min_rel_freq: float = 0,
    ) -> pd.DataFrame:
        """Get unique objects per type/qualifier for given activity
        Includes the share of events that are related to at least one of the given otype/qualifier (nonzero_rel)
        Filter for max. 1 object of its type/qualifier per event, and minimum relative frequency per event as described above.
        Includes rows with qualifier=None representing otype/activity relations with any qualifier.
        """

        # Unique without qualifier filtering (sum over qualifiers of min/max/mean)
        rel_stats_overall = self.objects_per_activity.groupby(
            ["ocel:activity", "ocel:type"], as_index=False
        )[["min", "max", "nonzero_rel"]].agg("sum")
        rel_stats_overall.insert(2, "ocel:qualifier", None)

        # Unique per qualifier
        rel_stats_qual = self.objects_per_activity[rel_stats_overall.columns.tolist()]

        rel_stats = pd.concat(
            [rel_stats_overall, rel_stats_qual],
            ignore_index=True,
        ).sort_values(
            ["ocel:activity", "ocel:type", "ocel:qualifier"], na_position="first"
        )
        rel_stats = rel_stats[
            (rel_stats["max"] == 1) & (rel_stats["nonzero_rel"] >= min_rel_freq)
        ]
        return rel_stats

    def filter_relations(
        self,
        otype: str | None = None,
        otypes: Iterable[str] | None = None,
        activity: str | None = None,
        activities: Iterable[str] | None = None,
        qualifier: str | None = None,
        qualifiers: Iterable[str] | None = None,
        copy: bool = True,
    ) -> pd.DataFrame:
        return filter_relations(
            self,
            otype=otype,
            otypes=otypes,
            activity=activity,
            activities=activities,
            qualifier=qualifier,
            qualifiers=qualifiers,
            copy=copy,
        )

    # endregion

    # ----- E2O Qualifiers ------------------------------------------------------------------------------------------
    # region

    @property
    @instance_lru_cache()
    def qualifier_frequencies(self) -> pd.DataFrame:
        return self.type_relations

    @instance_lru_cache()
    def get_qualifiers(
        self,
        otype: str | None = None,
        activity: str | None = None,
    ) -> set[str]:
        qf = self.qualifier_frequencies
        if otype:
            qf = qf[qf["ocel:type"] == otype]
        if activity:
            qf = qf[qf["ocel:activity"] == activity]
        return set(qf["ocel:qualifier"])

    @instance_lru_cache()
    def are_qualifiers_unique(self) -> bool:
        """Returns true iff e2o qualifiers are uniquely determined by activity and object type."""
        return (
            self.type_relations.groupby(["ocel:activity", "ocel:type"]).size() == 1
        ).all()  # type: ignore

    # endregion

    # ----- HELPER FUNCTIONS ------------------------------------------------------------------------------------------
    # region
    def join_otype(
        self, df: pd.DataFrame, col_oid: str = "ocel:oid", col_otype: str = "ocel:type"
    ) -> pd.DataFrame:
        """Enriches a DataFrame containing an object ID column with their object types."""
        return df.join(self.obj_otypes.rename(col_otype), on=col_oid)

    def join_otypes(
        self,
        df: pd.DataFrame,
        col_oid_1: str = "ocel:oid_1",
        col_oid_2: str = "ocel:oid_2",
        col_otype_1: str = "ocel:type_1",
        col_otype_2: str = "ocel:type_2",
    ) -> pd.DataFrame:
        """Enriches a DataFrame containing two object ID columns with their object types."""
        df = df.join(self.obj_otypes.rename(col_otype_1), on=col_oid_1)
        df = df.join(self.obj_otypes.rename(col_otype_2), on=col_oid_2)
        return df

    def join_activity(
        self,
        df: pd.DataFrame,
        col_eid: str = "ocel:eid",
        col_activity: str = "ocel:activity",
    ) -> pd.DataFrame:
        """Enriches a DataFrame containing an event ID column with their event types (activities)."""
        return df.join(self.event_activities.rename(col_activity), on=col_eid)

    def join_activities(
        self,
        df: pd.DataFrame,
        col_eid_1: str = "ocel:eid_1",
        col_eid_2: str = "ocel:eid_2",
        col_activity_1: str = "ocel:activity_1",
        col_activity_2: str = "ocel:activity_2",
    ) -> pd.DataFrame:
        """Enriches a DataFrame containing two event ID columns with their event types (activities)."""
        df = df.join(self.event_activities.rename(col_activity_1), on=col_eid_1)
        df = df.join(self.event_activities.rename(col_activity_2), on=col_eid_2)
        return df

    # endregion

    # ----- OCELWrapper CLASS UTILS ------------------------------------------------------------------------------------------
    # region

    def __str__(self):
        return f"OCELWrapper [{len(self.events)} events, {len(self.objects)} objects]"

    def __repr__(self):
        return str(self)

    def __deepcopy__(self, memo: dict[int, Any]):
        # TODO revisit this. Are the underlying DataFrames mutable? If not, might optimize this
        pm4py_ocel = deepcopy(self.ocel, memo)
        ocel = OCELWrapper(ocel=pm4py_ocel, id=str(uuid4()))
        ocel.meta = deepcopy(self.meta, memo)
        return ocel

    @property
    def cache_size(self):
        return {
            name: cache_info.currsize for name, cache_info in self._cache_info.items()
        }

    # endregion

    # ----- CONSTRUCTOR-LIKE ----------------------------------------------------------------------------------
    # region

    def event_projections(self, events: list[set[str]]) -> list[OCELWrapper]:
        """
        Given subsets of the event IDs (not necessarily distinct or complete),
        create new OCELs, each containing the given event set.
        The new OCELs contain all objects linked to the given events.
        """
        split = []
        for C in events:
            sublog = pm4py.filter_ocel_events(self.ocel, C)
            split.append(OCELWrapper(sublog))
        return split

    def object_projections(self, objects: list[set[str]]) -> list[OCELWrapper]:
        """
        Given subsets of the object IDs (not necessarily distinct or complete),
        create new OCELs, each containing the given object set.
        The new OCELs contain all events linked to the given objects.
        """
        split = []
        for C in objects:
            sublog = pm4py.filter_ocel_objects(self.ocel, C)
            split.append(OCELWrapper(sublog))
        return split

    # endregion

    # ----- EXTENTIONS ------------------------------------------------------------------------------------------
    # region
    def load_extension(self):
        path = self.meta.get("path")

        if not path:
            logger.warning("Extension loading skipped: No path info in OCELWrapper.")
            return

        path = Path(path)

        for ext_cls in get_registered_extensions():
            try:
                if (
                    path.suffix in ext_cls.supported_extensions
                    and ext_cls.has_extension(path)
                ):
                    self._extensions[ext_cls.name] = ext_cls.import_extension(path)
            except Exception as e:
                logger.warning(f"Extension load failed for '{ext_cls.name}': {e}")

    def get_extension(self, name: str) -> Optional[OcelExtension]:
        return self._extensions.get(name)

    def get_extensions_list(self) -> list[OcelExtension]:
        """Returns a list of all loaded extensions."""
        return list(self._extensions.values())

    # endregion
    # ----- IMPORT WRAPPER FUNCTIONS ------------------------------------------------------------------------------------------
    # region
    @staticmethod
    def read_ocel(
        path: PathLike,
        original_file_name: str | None = None,
        version_info: bool = False,
        output: bool = True,
        upload_date: datetime | None = None,
    ) -> OCELWrapper:
        report = {}
        if not isinstance(path, Path):
            path = Path(path)

        init_output = [f"Importing OCEL 2.0 at {path}"]

        if version_info:
            report["pythonVersion"] = platform.python_version()
            report["pm4pyVersion"] = pm4py.__version__
            if output:
                init_output += [
                    f"python {sys.version}",
                    f"pm4py {pm4py.__version__}",
                ]
        if output:
            logger.info("\n".join(init_output))

        with warnings.catch_warnings(record=True):
            match path.suffix:
                case ".sqlite":
                    pm4py_ocel = pm4py.read.read_ocel2_sqlite(str(path))
                case ".xmlocel":
                    pm4py_ocel = pm4py.read.read_ocel2_xml(str(path))
                case ".jsonocel":
                    pm4py_ocel = pm4py.read.read_ocel2_xml(str(path))
                case _:
                    raise ValueError(f"Unsupported extension: {path.suffix}")

        ocel = OCELWrapper(pm4py_ocel)

        report["ocelStrPm4py"] = str(pm4py_ocel)
        report["ocelStr"] = str(ocel)

        ocel.meta = {
            "path": str(path),
            "fileName": original_file_name or str(path.name),
            "importReport": report,
            "uploadDate": upload_date.isoformat()
            if upload_date
            else datetime.now().isoformat(),
        }

        ocel.load_extension()

        if output:
            logger.info(pm4py_ocel)

        return ocel

    def write_ocel(
        self,
        file_path: PathLike,
        ext: Optional[Literal[".json", ".xml", ".sqlite"]],
    ):
        match ext:
            case ".xml":
                pm4py.write_ocel2_xml(self.ocel, str(file_path))
            case ".json":
                pm4py.write_ocel2_json(self.ocel, str(file_path))
            case _:
                pm4py.write_ocel2_sqlite(self.ocel, str(file_path))

    # endregion
    #
    def rename(self, new_name: str):
        self.meta["fileName"] = new_name


@dataclass
class Filtered_Ocel:
    original: OCELWrapper
    filter: Optional[list[FilterConfig]] = None
    filtered: Optional[OCELWrapper] = None
