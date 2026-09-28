"""Names used by the quantity extension once it is *in* an OCEL.

The column names its tables carry and the tables it is stored in. Files use the
same names; how the deprecated file formats spelled them lives with their readers
in :mod:`ocelescope.ocel.io.extras.quantities`.
"""

from ocelescope.ocel.constants.pm4py import EID_COL, OID_COL

QEL_ITEM_TYPE = "qel:item_type"
QEL_QUANTITY = "qel:quantity"
QEL_QUANTITY_UPDATE = "qel:quantity_update"

OQTY_COLUMNS = [OID_COL, QEL_ITEM_TYPE, QEL_QUANTITY]
QOP_COLUMNS = [OID_COL, EID_COL, QEL_ITEM_TYPE, QEL_QUANTITY]

#: Names of the DuckDB tables the quantity extension is stored in.
QUANTITIES_TABLE = "quantities"
QUANTITY_OPERATIONS_TABLE = "quantity_operations"
QUANTITY_ITEM_PROPERTIES_TABLE = "quantity_item_properties"
