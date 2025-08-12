from __future__ import annotations
import platform
import warnings
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Any, Iterable, Literal, Optional, TypeVar, cast
from uuid import uuid4

import networkx as nx
import numpy as np
import pandas as pd
from cachetools import LRUCache
import pm4py
from pm4py.objects.ocel.obj import OCEL as PM4PYOCEL

from ocelescope.ocel.constants import OCELFileExtensions
from ocelescope.util.cache import instance_lru_cache
from ocelescope.util.pandas import mmmm

from ocelescope.ocel.extension import OCELExtension

from ocelescope.ocel.filter import OCELFilter

from ocelescope.ocel.util.attributes import (
    AttributeSummary,
    summarize_event_attributes,
    summarize_object_attributes,
)
from ocelescope.ocel.util.relations import summarize_e2o_counts, summarize_o2o_counts


T = TypeVar("T", bound="OCELExtension")


class OCEL:
    def __init__(self, ocel: PM4PYOCEL, id: Optional[str] = None):
        self._id = id if id is not None else str(uuid4())

        self.ocel: PM4PYOCEL = ocel
        # Metadata, to be set manually after creating the instance
        self.meta: dict[str, Any] = {}
        self._cache_info = {}

        # Used to distinguish multiple ocels with the same id but one is filtered form
        self.state_id = str(uuid4())

        # extensions
        self._extensions: dict[type[OCELExtension], OCELExtension] = {}

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

    def apply_filter(self, filters: OCELFilter) -> OCEL:
        from .filter import apply_filters

        filtered_ocel = apply_filters(self, filters=filters)
        filtered_ocel.meta = self.meta
        filtered_ocel._extensions = self._extensions

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
            raise ValueError("OCPN Discovery received invalid or empty object type set.")

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

    # ----- O2O RELATIONS ------------------------------------------------------------------------------------------
    # region

    @property
    @instance_lru_cache()
    def o2o(self):
        """O2O relationships, with object types"""
        return self.join_otypes(self.ocel.o2o.rename(columns={"ocel:oid": "ocel:oid_1"}))

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
        return sorted([col for col in self.ocel.events.columns if not col.startswith("ocel:")])

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
                for col in self.ocel.object_changes.columns[self.ocel.object_changes.count() > 0]
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
            self.relations.groupby(["ocel:eid", "ocel:activity", "ocel:type"], as_index=False)
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
            self.relations.groupby(["ocel:eid", "ocel:type", "ocel:qualifier"], as_index=False)
            .agg({"ocel:oid": "size", "ocel:activity": "first"})
            .rename(columns={"ocel:oid": "num_objs"})
        )
        act_otype_counts = (
            event_otypes.groupby(["ocel:activity", "ocel:type", "ocel:qualifier"], as_index=False)[
                "num_objs"
            ]
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
        ).sort_values(["ocel:activity", "ocel:type", "ocel:qualifier"], na_position="first")
        rel_stats = rel_stats[(rel_stats["max"] == 1) & (rel_stats["nonzero_rel"] >= min_rel_freq)]
        return rel_stats

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
        return (self.type_relations.groupby(["ocel:activity", "ocel:type"]).size() == 1).all()  # type: ignore

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
        ocel = OCEL(ocel=pm4py_ocel, id=str(uuid4()))
        ocel.meta = deepcopy(self.meta, memo)
        return ocel

    @property
    def cache_size(self):
        return {name: cache_info.currsize for name, cache_info in self._cache_info.items()}

    # endregion

    # ----- CONSTRUCTOR-LIKE ----------------------------------------------------------------------------------
    # region

    def event_projections(self, events: list[set[str]]) -> list[OCEL]:
        """
        Given subsets of the event IDs (not necessarily distinct or complete),
        create new OCELs, each containing the given event set.
        The new OCELs contain all objects linked to the given events.
        """
        split = []
        for C in events:
            sublog = pm4py.filter_ocel_events(self.ocel, C)
            split.append(OCEL(sublog))
        return split

    def object_projections(self, objects: list[set[str]]) -> list[OCEL]:
        """
        Given subsets of the object IDs (not necessarily distinct or complete),
        create new OCELs, each containing the given object set.
        The new OCELs contain all events linked to the given objects.
        """
        split = []
        for C in objects:
            sublog = pm4py.filter_ocel_objects(self.ocel, C)
            split.append(OCEL(sublog))
        return split

    # endregion

    # ----- IMPORT WRAPPER FUNCTIONS ------------------------------------------------------------------------------------------
    # region
    @staticmethod
    def read_ocel(
        path: Path,
        original_file_name: str | None = None,
        version_info: bool = False,
        upload_date: datetime | None = None,
    ) -> OCEL:
        report = {}

        if version_info:
            report["pythonVersion"] = platform.python_version()
            report["pm4pyVersion"] = pm4py.__version__

        with warnings.catch_warnings(record=True):
            match path.suffix:
                case ".sqlite":
                    pm4py_ocel = pm4py.read.read_ocel2_sqlite(str(path))
                case ".xmlocel":
                    pm4py_ocel = pm4py.read.read_ocel2_xml(str(path))
                case ".jsonocel":
                    pm4py_ocel = pm4py.read.read_ocel2_json(str(path))
                case _:
                    raise ValueError(f"Unsupported extension: {path.suffix}")

        ocel = OCEL(pm4py_ocel)

        report["ocelStrPm4py"] = str(pm4py_ocel)
        report["ocelStr"] = str(ocel)

        ocel.meta = {
            "path": str(path),
            "fileName": original_file_name or str(path.name),
            "importReport": report,
            "uploadDate": upload_date.isoformat() if upload_date else datetime.now().isoformat(),
        }

        return ocel

    def write_ocel(
        self,
        file_path: Path,
        ext: OCELFileExtensions,
    ):
        match ext:
            case ".xmlocel":
                pm4py.write_ocel2_xml(self.ocel, str(file_path))
            case ".jsonocel":
                pm4py.write_ocel2_json(self.ocel, str(file_path))
            case _:
                pm4py.write_ocel2_sqlite(self.ocel, str(file_path))

        for extension in self.get_extensions_list():
            if ext in extension.supported_extensions:
                try:
                    extension.export_extension(file_path)
                except Exception:
                    print("failed to write extension")

    # endregion
    #
    def rename(self, new_name: str):
        self.meta["fileName"] = new_name

    # ----- EXTENTIONS ------------------------------------------------------------------------------------------
    # region
    def load_extension(self, extensions: list[type[OCELExtension]]):
        path = self.meta.get("path")

        if not path:
            return

        path = Path(path)

        for ext_cls in extensions:
            try:
                if path.suffix in ext_cls.supported_extensions and ext_cls.has_extension(path):
                    self._extensions[ext_cls] = ext_cls.import_extension(path)
            except Exception:
                print("failed to load extension")

    def get_extension(self, extension: type[T]) -> Optional[T]:
        return cast(Optional[T], self._extensions.get(extension))

    def get_extensions_list(self) -> list[OCELExtension]:
        """Returns a list of all loaded extensions."""
        return list(self._extensions.values())

    # endregion
