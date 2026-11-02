"""Plotly summary of an OCEL, mirroring the bar lists the frontend renders."""

import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from ocelescope import OCEL, Plotly

DEFAULT_TOP_N = 8

_ACTIVITY_COLOR = "#228be6"
_OBJECT_COLOR = "#12b886"


def _bars(counts: pd.Series, color: str) -> go.Bar:
    """Horizontal bars, most frequent on top."""
    ordered = counts.iloc[::-1]
    values = [int(value) for value in ordered]

    return go.Bar(
        x=values,
        y=[str(label) for label in ordered.index],
        orientation="h",
        marker_color=color,
        text=[f"{value:,}" for value in values],
        textposition="outside",
        cliponaxis=False,
        hovertemplate="%{y}: %{x:,}<extra></extra>",
    )


def _title(label: str, counts: pd.Series, top_n: int) -> str:
    total = len(counts)
    return (
        f"{label} (top {top_n} of {total:,})"
        if total > top_n
        else f"{label} ({total:,})"
    )


def visualize_ocel(ocel: OCEL, top_n: int = DEFAULT_TOP_N) -> Plotly:
    """Chart the activity and object type frequencies of an OCEL."""
    activity_counts = ocel.events.activity_counts
    object_counts = ocel.objects.counts

    figure = make_subplots(
        rows=2,
        cols=1,
        subplot_titles=(
            _title("Activity", activity_counts, top_n),
            _title("Object type", object_counts, top_n),
        ),
        vertical_spacing=0.15,
    )
    figure.add_trace(_bars(activity_counts.head(top_n), _ACTIVITY_COLOR), row=1, col=1)
    figure.add_trace(_bars(object_counts.head(top_n), _OBJECT_COLOR), row=2, col=1)

    figure.update_xaxes(visible=False)
    figure.update_yaxes(automargin=True, ticksuffix="  ")
    figure.update_layout(
        showlegend=False,
        bargap=0.35,
        margin={"l": 8, "r": 32, "t": 32, "b": 8},
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
    )

    return Plotly(figure)
