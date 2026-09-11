"""Names used by the quantity extension: our own, and each file format's.

The first group is how a quantity extension looks once it is *in* an OCEL -- the
column names its tables carry and the tables it is stored in. The rest is how the
OCEL 2.0 formats spell the same things on disk, which the importers and exporters
translate to and from.
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
