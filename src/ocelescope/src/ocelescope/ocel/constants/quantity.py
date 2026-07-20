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

# TODO: THIS IS ALL A MESS FIX IN FUTURE

# ---------------------------------------------------------------------------
# XML: element and attribute names
# ---------------------------------------------------------------------------
XML_QUANTITY_EXTENSION = "quantity-extension"
XML_OPERATIONS = "operations"
XML_OPERATION = "operation"
XML_PROPERTIES = "item-properties"
XML_PROPERTIES_TYPE = "item-type"
XML_PROPERTIES_TYPE_NAME = "name"
XML_PROPERTY = "property"
XML_PROPERTY_NAME = "name"
XML_PROPERTY_TYPE = "type"
XML_QUANTITIES = "quantities"
XML_QUANTITY = "quantity"
XML_EVENT_ID = "event-id"
XML_OBJECT_ID = "object-id"
XML_ITEM = "item"
XML_ITEM_TYPE = "type"
XML_QUANTITY_TYPE = "type"

# ---------------------------------------------------------------------------
# JSON: object keys
# ---------------------------------------------------------------------------
JSON_QUANTITY_EXTENSION = "quantityExtension"
JSON_OPERATIONS = "operations"
JSON_PROPERTIES = "itemTypes"
JSON_QUANTITIES = "quantities"

#: Our column name -> the key a JSON log spells it with.
JSON_KEYMAP = {
    EID_COL: "eventId",
    OID_COL: "objectId",
    QEL_ITEM_TYPE: "type",
    QEL_QUANTITY: "quantity",
}

# ---------------------------------------------------------------------------
# SQLite: table and column names
# ---------------------------------------------------------------------------
SQL_OPERATIONS = "operation"
SQL_QUANTITIES = "quantity"
SQL_ITEM_PROPERTIES = "itemProperties"

#: Our column name -> the column a SQLite log spells it with.
SQL_KEYMAP = {
    EID_COL: "ocel_event_id",
    OID_COL: "ocel_object_id",
    QEL_ITEM_TYPE: "type",
    QEL_QUANTITY: "quantity",
}


def inverse_keymap(keymap: dict[str, str]) -> dict[str, str]:
    """Flip a keymap, to rename a format's names back to ours."""
    return {v: k for k, v in keymap.items()}
