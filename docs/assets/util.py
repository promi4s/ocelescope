from ocelescope import OCEL
from graphviz import Digraph


def discover_dfg(
    ocel: OCEL, used_object_types: list[str]
) -> list[tuple[str | None, str, str | None]]:
    import pm4py

    ocel_filtered = pm4py.filter_ocel_object_types(
        ocel.ocel, used_object_types, positive=True
    )
    ocdfg = pm4py.discover_ocdfg(ocel_filtered)
    edges: list[tuple[str | None, str, str | None]] = []
    for object_type, raw_edges in ocdfg["edges"]["event_couples"].items():
        edges = edges + (
            [(source, object_type, target) for source, target in raw_edges]
        )

        edges += [
            (activity, object_type, None)
            for object_type, activities in ocdfg["start_activities"]["events"].items()
            for activity in activities.keys()
        ]

        edges += [
            (None, object_type, activity)
            for object_type, activities in ocdfg["end_activities"]["events"].items()
            for activity in activities.keys()
        ]
    return edges


def convert_dfg_to_graphviz(dfg: list[tuple[str | None, str, str | None]]) -> Digraph:
    from graphviz import Digraph
    import itertools

    dot = Digraph("Ugly DFG")
    dot.attr(rankdir="LR")

    outer_nodes = set()
    inner_sources = {}
    inner_sinks = {}
    edges_seen = set()
    types = set()

    for src, x, tgt in dfg:
        if src is not None:
            outer_nodes.add(src)
        if tgt is not None:
            outer_nodes.add(tgt)
        if x is not None:
            types.add(x)
            inner_sources[x] = f"source_{x}"
            inner_sinks[x] = f"sink_{x}"
        edges_seen.add((src, x, tgt))

    # A palette of colors
    palette = [
        "red",
        "blue",
        "green",
        "orange",
        "purple",
        "brown",
        "gold",
        "pink",
        "cyan",
        "magenta",
    ]
    color_map = {x: c for x, c in zip(sorted(types), itertools.cycle(palette))}

    # Outer nodes: neutral color
    for n in outer_nodes:
        dot.node(n, shape="rectangle", style="filled", fillcolor="lightgray")

    # Sources and sinks: colored small circles, with xlabel underneath
    for x in types:
        color = color_map[x]
        dot.node(
            inner_sources[x],
            shape="circle",
            style="filled",
            fillcolor=color,
            width="1",
            height="1",
            fixedsize="true",
            label="",
            xlabel=x,
        )
        dot.node(
            inner_sinks[x],
            shape="circle",
            style="filled",
            fillcolor=color,
            width="1",
            height="1",
            label="",
            fixedsize="true",
            xlabel=x,
        )

    # Rank groups
    with dot.subgraph() as s:
        s.attr(rank="same")
        for n in inner_sources.values():
            s.node(n)

    with dot.subgraph() as s:
        s.attr(rank="same")
        for n in inner_sinks.values():
            s.node(n)

    # Add edges with thicker lines
    for src, x, tgt in edges_seen:
        if x is None:
            continue
        color = color_map[x]
        if src is not None and tgt is not None:
            dot.edge(src, tgt, color=color, penwidth="2")
        elif src is None and tgt is not None:
            dot.edge(tgt, inner_sinks[x], color=color, penwidth="2")
        elif src is not None and tgt is None:
            dot.edge(src, inner_sources[x], color=color, penwidth="2")

    return dot
