"""Contract for module filters.

A :class:`ModuleFilter` is an :class:`ocelescope.ocel.filter.BaseFilter` that a
module pushes over the API: it defines a *view* -- a valid subset of an OCEL -- by
returning, from a single ``keep``, the ids to keep as a
:class:`ocelescope.ocel.filter.Keep`. Everything about how filters are written and
applied lives in the library; this only adds what the API needs on top, which is a
``type`` discriminator so a pipeline can be serialized and read back.

The *concrete* filters live in the modules that push them (e.g.
``ocelescope-module-filter``); a pipeline is applied with :meth:`ocelescope.OCEL.filter`.
"""

from __future__ import annotations

from ocelescope.ocel.filter import BaseFilter, Keep

__all__ = ["Keep", "ModuleFilter"]


class ModuleFilter(BaseFilter):
    """A filter a module defines, discriminated by its ``type`` over the API."""
