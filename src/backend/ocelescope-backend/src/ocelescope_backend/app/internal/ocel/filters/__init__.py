"""The module-filter contract and engine (DuckDB + lazy polars, no ibis).

A :class:`ModuleFilter` defines a view -- a valid subset -- by returning, from a
single :meth:`ModuleFilter.keep`, the event/object ids to keep as a :class:`Keep`,
read as lazy polars from an :class:`OCELDb`. :func:`apply_filters` runs a pipeline
once, writing a filtered DuckDB file that both the pm4py OCEL and the ``OCELDb`` are
read from. The *concrete* filters live in the modules that push them (e.g.
``ocelescope-module-filter``); this package only owns the base + applier.
"""

from ocelescope_backend.app.internal.ocel.filters.apply import apply_filters
from ocelescope_backend.app.internal.ocel.filters.base import Keep, ModuleFilter

__all__ = [
    "Keep",
    "ModuleFilter",
    "apply_filters",
]
