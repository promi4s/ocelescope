"""Streaming importers that turn OCEL 2.0 logs into a DuckDB database.

``import_ocel_json`` / ``import_ocel_xml`` / ``import_ocel_sqlite`` read a log
incrementally and write the five flat OCEL tables (objects, object_changes, o2o,
events, e2o) into a single DuckDB file via the shared :class:`OCELWriter`.
"""

from ocelescope.ocel.io.json import import_ocel_json
from ocelescope.ocel.io.sqlite import import_ocel_sqlite
from ocelescope.ocel.io.writer import OCELWriter
from ocelescope.ocel.io.xml import import_ocel_xml

__all__ = [
    "OCELWriter",
    "import_ocel_json",
    "import_ocel_sqlite",
    "import_ocel_xml",
]
