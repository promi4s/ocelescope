"""The module-filter contract.

A :class:`ModuleFilter` defines a view -- a valid subset -- by returning, from a
single ``keep``, the event/object ids to keep as a :class:`Keep`, read as lazy
polars off the :class:`ocelescope.OCEL` it is given. A pipeline is applied with
:meth:`ocelescope.OCEL.filter`, which builds the filtered log in one pass; the
session then persists that as a DuckDB file, so a per-request read never re-filters.

The *concrete* filters live in the modules that push them (e.g.
``ocelescope-module-filter``); this package only owns the base.
"""

from ocelescope_backend.app.internal.ocel.filters.base import Keep, ModuleFilter

__all__ = [
    "Keep",
    "ModuleFilter",
]
