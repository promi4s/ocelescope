"""Names of the DuckDB tables an OCEL's core relations are stored in.

One place for the table names the managers read and write, so a rename is a
single edit rather than a string hunt across every manager. The quantity
extension keeps its own table names in :mod:`ocelescope.ocel.constants.quantity`.
"""

EVENTS_TABLE = "events"
OBJECTS_TABLE = "objects"
OBJECT_CHANGES_TABLE = "object_changes"
E2O_TABLE = "e2o"
O2O_TABLE = "o2o"
