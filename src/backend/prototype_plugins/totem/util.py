from datetime import datetime
import math
import numpy as np
import pm4py
from pm4py.objects.ocel.obj import OCEL
import pandas as pd

import networkx as nx
from .outputs.totem import Totem, TotemEdge


def o2o_tuples(ocel: OCEL):
    return np.array(list(zip(ocel.o2o["ocel:oid_2"], ocel.o2o["ocel:oid"]))).tolist()


def create_event_dict(ocel: OCEL) -> dict:
    # Step 1: Get full event table
    df = ocel.get_extended_table()

    # Step 2: Rename standard columns
    df = df.rename(
        columns={"ocel:timestamp": "timestamp", "ocel:activity": "event_type"}
    )

    # Step 3: Convert timestamp to naive datetime
    df["timestamp"] = pd.to_datetime(df["timestamp"]).dt.tz_localize(None)

    # Step 4: Identify and rename object type columns
    type_cols = [col for col in df.columns if col.startswith("ocel:type:")]
    rename_map = {col: col.replace("ocel:type:", "") for col in type_cols}
    df = df.rename(columns=rename_map)

    object_cols = list(rename_map.values())

    # Step 5: Normalize object columns (NaN → [], keep lists)
    df[object_cols] = df[object_cols].applymap(
        lambda v: [] if isinstance(v, float) and math.isnan(v) else v
    )

    # Step 6: Add a new "objects" column: merged object IDs from all types
    df["objects"] = df[object_cols].apply(
        lambda row: [item for sublist in row for item in sublist], axis=1
    )

    # Step 7: Return as dict with event ID as key
    return df.set_index(ocel.event_id_column).to_dict(orient="index")


def compute_event_object_graph(ocel: OCEL) -> nx.DiGraph:
    """
    Builds a directed event-object graph (EOG) from an OCEL using directly-follows per object.

    Each event becomes a node, and edges are added between events that refer to the same object
    and occur consecutively in time.

    :param ocel: PM4Py OCEL object
    :return: networkx.DiGraph representing the EOG
    """
    event_object_graph = nx.DiGraph()

    # Step 1: Add each event as a node in the graph
    event_ids = ocel.events[ocel.event_id_column].to_list()
    event_object_graph.add_nodes_from(event_ids)

    # Step 2: Sort and group by object, then generate adjacent event pairs
    object_with_sorted_events = (
        ocel.relations.sort_values(ocel.event_timestamp)
        .groupby(ocel.object_id_column)["ocel:eid"]
        .apply(lambda lst: list(zip(lst, lst[1:])))  # adjacent pairs only
        .explode()
        .dropna()
        .to_list()
    )

    # Step 3: Add those event-event edges to the graph
    event_object_graph.add_edges_from(object_with_sorted_events)

    return event_object_graph


def compute_process_executions_connected_components(ocel: OCEL):
    return sorted(
        nx.weakly_connected_components(compute_event_object_graph(ocel)),
        key=len,
        reverse=True,
    )


def get_object_types(ocel: OCEL):
    return pm4py.ocel_get_object_types(ocel)


# temporal relation constants (constants serving as a representation that is easier to understand than just the numbers)
TR_TOTAL = "total"
TR_DEPENDENT = "D"
TR_DEPENDENT_INVERSE = "Di"
TR_INITIATING = "I"
TR_INITIATING_REVERSE = "Ii"
TR_PARALLEL = "P"

# Event cardinality constants
EC_TOTAL = "total"
EC_ZERO = "0"
EC_ONE = "1"
EC_ZERO_ONE = "0...1"
EC_MANY = "1..*"
EC_ZERO_MANY = "0...*"

# Event cardinality constants
LC_TOTAL = "total"
LC_ZERO = "0"
LC_ONE = "1"
LC_ZERO_ONE = "0...1"
LC_MANY = "1..*"
LC_ZERO_MANY = "0...*"

DATEFORMAT = "%Y-%m-%d %H:%M:%S"


def get_all_event_objects(ocel, event_id):
    obj_ids = []
    for obj_type in ocel.object_types:
        obj_ids += ocel.get_value(event_id, obj_type)
    return obj_ids


def get_most_precise_lc(directed_type_tuple, tau, log_cardinalities):
    total = 0
    if (
        directed_type_tuple in log_cardinalities.keys()
        and LC_TOTAL in log_cardinalities[directed_type_tuple].keys()
    ):
        total = log_cardinalities[directed_type_tuple][LC_TOTAL]

    if total == 0:
        return None

    if (LC_ZERO in log_cardinalities[directed_type_tuple].keys()) and (
        (log_cardinalities[directed_type_tuple][LC_ZERO] / total) >= tau
    ):
        return LC_ZERO
    if (LC_ONE in log_cardinalities[directed_type_tuple].keys()) and (
        (log_cardinalities[directed_type_tuple][LC_ONE] / total) >= tau
    ):
        return LC_ONE
    if (LC_ZERO_ONE in log_cardinalities[directed_type_tuple].keys()) and (
        (log_cardinalities[directed_type_tuple][LC_ZERO_ONE] / total) >= tau
    ):
        return LC_ZERO_ONE
    if (LC_MANY in log_cardinalities[directed_type_tuple].keys()) and (
        (log_cardinalities[directed_type_tuple][LC_MANY] / total) >= tau
    ):
        return LC_MANY
    if (LC_ZERO_MANY in log_cardinalities[directed_type_tuple].keys()) and (
        (log_cardinalities[directed_type_tuple][LC_ZERO_MANY] / total) >= tau
    ):
        return LC_ZERO_MANY

    return None


def get_most_precise_ec(directed_type_tuple, tau, event_cardinalities):
    total = 0
    if (
        directed_type_tuple in event_cardinalities.keys()
        and EC_TOTAL in event_cardinalities[directed_type_tuple].keys()
    ):
        total = event_cardinalities[directed_type_tuple][EC_TOTAL]

    if total == 0:
        return None

    if (EC_ZERO in event_cardinalities[directed_type_tuple].keys()) and (
        (event_cardinalities[directed_type_tuple][EC_ZERO] / total) >= tau
    ):
        return EC_ZERO
    if (EC_ONE in event_cardinalities[directed_type_tuple].keys()) and (
        (event_cardinalities[directed_type_tuple][EC_ONE] / total) >= tau
    ):
        return EC_ONE
    if (EC_ZERO_ONE in event_cardinalities[directed_type_tuple].keys()) and (
        (event_cardinalities[directed_type_tuple][EC_ZERO_ONE] / total) >= tau
    ):
        return EC_ZERO_ONE
    if (EC_MANY in event_cardinalities[directed_type_tuple].keys()) and (
        (event_cardinalities[directed_type_tuple][EC_MANY] / total) >= tau
    ):
        return EC_MANY
    if (EC_ZERO_MANY in event_cardinalities[directed_type_tuple].keys()) and (
        (event_cardinalities[directed_type_tuple][EC_ZERO_MANY] / total) >= tau
    ):
        return EC_ZERO_MANY

    return None


def get_most_precise_tr(directed_type_tuple, tau, temporal_relation):
    total = 0
    if (
        directed_type_tuple in temporal_relation.keys()
        and EC_TOTAL in temporal_relation[directed_type_tuple].keys()
    ):
        total = temporal_relation[directed_type_tuple][EC_TOTAL]

    if total == 0:
        return None

    if (TR_DEPENDENT in temporal_relation[directed_type_tuple].keys()) and (
        (temporal_relation[directed_type_tuple][TR_DEPENDENT] / total) >= tau
    ):
        return TR_DEPENDENT
    if (TR_DEPENDENT_INVERSE in temporal_relation[directed_type_tuple].keys()) and (
        (temporal_relation[directed_type_tuple][TR_DEPENDENT_INVERSE] / total) >= tau
    ):
        return TR_DEPENDENT_INVERSE
    if (TR_INITIATING in temporal_relation[directed_type_tuple].keys()) and (
        (temporal_relation[directed_type_tuple][TR_INITIATING] / total) >= tau
    ):
        return TR_INITIATING
    if (TR_INITIATING_REVERSE in temporal_relation[directed_type_tuple].keys()) and (
        (temporal_relation[directed_type_tuple][TR_INITIATING_REVERSE] / total) >= tau
    ):
        return TR_INITIATING_REVERSE
    if (TR_PARALLEL in temporal_relation[directed_type_tuple].keys()) and (
        (temporal_relation[directed_type_tuple][TR_PARALLEL] / total) >= tau
    ):
        return TR_PARALLEL

    return None


def mine_totem(ocel, tau: float = 1) -> Totem:
    # temporal relations results
    h_temporal_relations: dict[tuple[str, str], dict[str, int]] = (
        dict()
    )  # stores all the temporal relations found
    # event cardinality results
    h_event_cardinalities: dict[tuple[str, str], dict[str, int]] = (
        dict()
    )  # stores all the temporal cardinalities found
    # event cardinality results
    h_log_cardinalities: dict[tuple[str, str], dict[str, int]] = (
        dict()
    )  # stores all the temporal cardinalities found

    # object min times (omint_L(o))
    o_min_times: dict[str, datetime] = (
        dict()
    )  # str identifier of the object maps to the earliest time recorded for that object in the event log
    # object max times (omaxt_L(o))
    o_max_times: dict[str, datetime] = (
        dict()
    )  # str identifier of the object maps to the last time recorded for that object in the event log

    # get a list of all object types (or variable that is filled while passing through the process executions)
    type_relations: set[set[str, str]] = set()  # stores all connected types
    # dict that describes which objects are connected to which types and for each type which object
    # o2o[obj1][type3] = [obj5, obj6]
    o2o: dict[str, dict[str, set[str]]] = dict()

    # a mapping from type to its objects
    type_to_object = dict()
    event_dict = create_event_dict(ocel)
    object_types = get_object_types(ocel)

    for px in compute_process_executions_connected_components(ocel):
        for ev in px:
            # event infos: objects and timestamps
            ev_timestamp = event_dict[ev]["timestamp"]

            objects_of_event = event_dict[ev]["objects"]
            for obj in objects_of_event:
                # o2o updating
                o2o.setdefault(obj, dict())
                for type in object_types:
                    o2o[obj].setdefault(type, set())
                    o2o[obj][type].update(
                        event_dict[ev][type]
                    )  # add all objects connected via e2o to each object involved
                # update lifespan information
                o_min_times.setdefault(obj, ev_timestamp)
                if (
                    ev_timestamp < o_min_times[obj]
                ):  # todo check if comparison of datetimes works correctly here
                    o_min_times[obj] = ev_timestamp
                o_max_times.setdefault(obj, ev_timestamp)
                if (
                    ev_timestamp > o_max_times[obj]
                ):  # todo check if comparison of datetimes works correctly here
                    o_max_times[obj] = ev_timestamp

            # compute event cardinality
            involved_types = []
            obj_count_per_type = dict()
            for type in object_types:
                obj_list = event_dict[ev][type]
                if not obj_list:
                    continue
                else:
                    type_to_object.setdefault(type, set())
                    type_to_object[type].update(obj_list)
                    involved_types.append(type)
                    obj_count_per_type[type] = len(obj_list)
            # created related types
            for t1 in involved_types:
                for t2 in involved_types:
                    if t1 != t2:
                        type_relations.add(frozenset({t1, t2}))
            # for all type pairs determine
            for type_source in involved_types:
                for type_target in object_types:
                    # add one to total
                    h_event_cardinalities.setdefault((type_source, type_target), dict())
                    h_event_cardinalities[(type_source, type_target)].setdefault(
                        EC_TOTAL, 0
                    )
                    h_event_cardinalities[(type_source, type_target)][EC_TOTAL] += 1
                    # determine cardinality
                    cardinality = 0
                    if type_target in obj_count_per_type.keys():
                        cardinality = obj_count_per_type[type_target]
                    # add one to matching cardinalities
                    if cardinality == 0:
                        h_event_cardinalities[(type_source, type_target)].setdefault(
                            EC_ZERO, 0
                        )
                        h_event_cardinalities[(type_source, type_target)][EC_ZERO] += 1
                        h_event_cardinalities[(type_source, type_target)].setdefault(
                            EC_ZERO_ONE, 0
                        )
                        h_event_cardinalities[(type_source, type_target)][
                            EC_ZERO_ONE
                        ] += 1
                        h_event_cardinalities[(type_source, type_target)].setdefault(
                            EC_ZERO_MANY, 0
                        )
                        h_event_cardinalities[(type_source, type_target)][
                            EC_ZERO_MANY
                        ] += 1
                    elif cardinality == 1:
                        h_event_cardinalities[(type_source, type_target)].setdefault(
                            EC_ONE, 0
                        )
                        h_event_cardinalities[(type_source, type_target)][EC_ONE] += 1
                        h_event_cardinalities[(type_source, type_target)].setdefault(
                            EC_ZERO_ONE, 0
                        )
                        h_event_cardinalities[(type_source, type_target)][
                            EC_ZERO_ONE
                        ] += 1
                        h_event_cardinalities[(type_source, type_target)].setdefault(
                            EC_MANY, 0
                        )
                        h_event_cardinalities[(type_source, type_target)][EC_MANY] += 1
                        h_event_cardinalities[(type_source, type_target)].setdefault(
                            EC_ZERO_MANY, 0
                        )
                        h_event_cardinalities[(type_source, type_target)][
                            EC_ZERO_MANY
                        ] += 1
                    elif cardinality > 1:
                        h_event_cardinalities[(type_source, type_target)].setdefault(
                            EC_MANY, 0
                        )
                        h_event_cardinalities[(type_source, type_target)][EC_MANY] += 1
                        h_event_cardinalities[(type_source, type_target)].setdefault(
                            EC_ZERO_MANY, 0
                        )
                        h_event_cardinalities[(type_source, type_target)][
                            EC_ZERO_MANY
                        ] += 1

    # merge o2o and e2o connected objects
    for source_o, target_o in o2o_tuples(ocel):
        type_of_target_o = None
        for type in object_types:
            if target_o in type_to_object[type]:
                type_of_target_o = type
                break
        if type_of_target_o is None:
            continue
        o2o.setdefault(source_o, dict())
        o2o[source_o].setdefault(type_of_target_o, set())
        o2o[source_o][type_of_target_o].update([source_o])

    result: list[TotemEdge] = []
    for type_source in object_types:
        for type_target in object_types:
            h_temporal_relations.setdefault((type_source, type_target), dict())
            for obj in type_to_object[type_source]:
                h_log_cardinalities.setdefault((type_source, type_target), dict())
                h_log_cardinalities[(type_source, type_target)].setdefault(LC_TOTAL, 0)
                h_log_cardinalities[(type_source, type_target)][LC_TOTAL] += 1

                cardinality = len(o2o[obj][type_target])

                if cardinality == 0:
                    h_log_cardinalities[(type_source, type_target)].setdefault(
                        LC_ZERO, 0
                    )
                    h_log_cardinalities[(type_source, type_target)][LC_ZERO] += 1
                    h_log_cardinalities[(type_source, type_target)].setdefault(
                        LC_ZERO_ONE, 0
                    )
                    h_log_cardinalities[(type_source, type_target)][LC_ZERO_ONE] += 1
                    h_log_cardinalities[(type_source, type_target)].setdefault(
                        LC_ZERO_MANY, 0
                    )
                    h_log_cardinalities[(type_source, type_target)][LC_ZERO_MANY] += 1
                elif cardinality == 1:
                    h_log_cardinalities[(type_source, type_target)].setdefault(
                        LC_ONE, 0
                    )
                    h_log_cardinalities[(type_source, type_target)][LC_ONE] += 1
                    h_log_cardinalities[(type_source, type_target)].setdefault(
                        LC_ZERO_ONE, 0
                    )
                    h_log_cardinalities[(type_source, type_target)][LC_ZERO_ONE] += 1
                    h_log_cardinalities[(type_source, type_target)].setdefault(
                        LC_MANY, 0
                    )
                    h_log_cardinalities[(type_source, type_target)][LC_MANY] += 1
                    h_log_cardinalities[(type_source, type_target)].setdefault(
                        LC_ZERO_MANY, 0
                    )
                    h_log_cardinalities[(type_source, type_target)][LC_ZERO_MANY] += 1
                elif cardinality > 1:
                    h_log_cardinalities[(type_source, type_target)].setdefault(
                        LC_MANY, 0
                    )
                    h_log_cardinalities[(type_source, type_target)][LC_MANY] += 1
                    h_log_cardinalities[(type_source, type_target)].setdefault(
                        LC_ZERO_MANY, 0
                    )
                    h_log_cardinalities[(type_source, type_target)][LC_ZERO_MANY] += 1

                # compute temporal relations
                for obj_target in o2o[obj][type_target]:
                    h_temporal_relations[(type_source, type_target)].setdefault(
                        TR_TOTAL, 0
                    )
                    h_temporal_relations[(type_source, type_target)][TR_TOTAL] += 1
                    if (
                        o_min_times[obj_target]
                        <= o_min_times[obj]
                        <= o_max_times[obj]
                        <= o_max_times[obj_target]
                    ):
                        h_temporal_relations[(type_source, type_target)].setdefault(
                            TR_DEPENDENT, 0
                        )
                        h_temporal_relations[(type_source, type_target)][
                            TR_DEPENDENT
                        ] += 1
                    if (
                        o_min_times[obj]
                        <= o_min_times[obj_target]
                        <= o_max_times[obj_target]
                        <= o_max_times[obj]
                    ):
                        h_temporal_relations[(type_source, type_target)].setdefault(
                            TR_DEPENDENT_INVERSE, 0
                        )
                        h_temporal_relations[(type_source, type_target)][
                            TR_DEPENDENT_INVERSE
                        ] += 1
                    if (
                        o_min_times[obj]
                        <= o_max_times[obj]
                        <= o_min_times[obj_target]
                        <= o_max_times[obj_target]
                    ) or (
                        o_min_times[obj]
                        < o_min_times[obj_target]
                        <= o_max_times[obj]
                        < o_max_times[obj_target]
                    ):
                        h_temporal_relations[(type_source, type_target)].setdefault(
                            TR_INITIATING, 0
                        )
                        h_temporal_relations[(type_source, type_target)][
                            TR_INITIATING
                        ] += 1
                    if (
                        o_min_times[obj_target]
                        <= o_max_times[obj_target]
                        <= o_min_times[obj]
                        <= o_max_times[obj]
                    ) or (
                        o_min_times[obj_target]
                        < o_min_times[obj]
                        <= o_max_times[obj_target]
                        < o_max_times[obj]
                    ):
                        h_temporal_relations[(type_source, type_target)].setdefault(
                            TR_INITIATING_REVERSE, 0
                        )
                        h_temporal_relations[(type_source, type_target)][
                            TR_INITIATING_REVERSE
                        ] += 1
                    # allways parallel
                    h_temporal_relations[(type_source, type_target)].setdefault(
                        TR_PARALLEL, 0
                    )
                    h_temporal_relations[(type_source, type_target)][TR_PARALLEL] += 1

        additional_t2t = {}
        # additional_t2t = {frozenset({'Customer Order', 'Transportation Documents'})}
        # merge type relations
        merged_type_relations = type_relations.union(additional_t2t)
        # for each connection give the 6 relations
        for connected_types in merged_type_relations:
            t1, t2 = connected_types

            lc = get_most_precise_lc((t1, t2), tau, h_log_cardinalities)
            lc_i = get_most_precise_lc((t2, t1), tau, h_log_cardinalities)

            ec = get_most_precise_ec((t1, t2), tau, h_event_cardinalities)
            ec_i = get_most_precise_ec((t2, t1), tau, h_event_cardinalities)

            tr = get_most_precise_tr((t1, t2), tau, h_temporal_relations)
            tr_i = get_most_precise_tr((t2, t1), tau, h_temporal_relations)

            relation = TotemEdge(
                source=t1,
                target=t2,
                lc=lc,
                lc_inverse=lc_i,
                ec=ec,
                ec_inverse=ec_i,
                tr=tr,
                tr_inverse=tr_i,
            )
            result.append(relation)

    # Filter and convert to TotemEdge instances
    edges: list[TotemEdge] = [
        TotemEdge(
            source=rel.source,
            target=rel.target,
            lc=rel.lc,  # type:ignore
            lc_inverse=rel.lc_inverse,  # type:ignore
            ec=rel.ec,  # type:ignore
            ec_inverse=rel.ec_inverse,  # type:ignore
            tr=rel.tr,  # type:ignore
            tr_inverse=rel.tr_inverse,  # type:ignore
        )
        for rel in result
        if all(
            value != "ERROR 0"
            for value in [
                rel.lc,
                rel.lc_inverse,
                rel.ec,
                rel.ec_inverse,
                rel.tr,
                rel.tr_inverse,
            ]
        )
    ]

    # Create final Totem object
    return Totem(
        object_types=sorted(object_types),
        edges=edges,
        type="totem",
    )
