"""Streaming importers that read an OCEL 2.0 file into the flat DuckDB tables.

Each reader parses its format incrementally and writes the five flat tables (plus
the optional quantity tables) through the shared :class:`OCELWriter`, so peak
memory stays bounded by a single entity rather than the whole log.
"""

from ocelescope.ocel.io.importers.json import import_ocel_json
from ocelescope.ocel.io.importers.sqlite import import_ocel_sqlite
from ocelescope.ocel.io.importers.writer import OCELWriter
from ocelescope.ocel.io.importers.xml import import_ocel_xml

__all__ = [
    "OCELWriter",
    "import_ocel_json",
    "import_ocel_sqlite",
    "import_ocel_xml",
]
