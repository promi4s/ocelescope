"""The module-filter contract and engine (DuckDB + lazy polars, no ibis).

A :class:`ModuleFilter` defines a view -- a valid subset -- by returning the ids to
keep from the lazy polars :class:`Tables`. :func:`apply_filters` runs a pipeline
once, writing a filtered DuckDB file that both the pm4py OCEL and the ``OCELDb``
are read from. The *concrete* filters live in the modules that push them (e.g.
``ocelescope-module-filter``); this package only owns the base + applier.
"""

from ocelescope_backend.app.internal.ocel.filters.apply import apply_filters
from ocelescope_backend.app.internal.ocel.filters.base import ModuleFilter, Tables

__all__ = [
    "ModuleFilter",
    "Tables",
    "apply_filters",
]
