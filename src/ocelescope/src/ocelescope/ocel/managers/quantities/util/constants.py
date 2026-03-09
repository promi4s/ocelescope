from ocelescope.ocel.constants.pm4py import EID_COL, OID_COL

QEL_ITEM_TYPE = "qel:item_type"
QEL_QUANTITY = "qel:quantity"
QEL_QUANTITY_UPDATE = "qel:quantity_update"
QEL_ILVL = "qel:itlvl"

OQTY_COLUMNS = [OID_COL, QEL_ITEM_TYPE, QEL_QUANTITY]
QOP_COLUMNS = [OID_COL, EID_COL, QEL_ITEM_TYPE, QEL_QUANTITY]

XML_QUANTITY_EXTENSION = "quantity-extension"
XML_OPERATIONS = "operations"
XML_OPERATION = "operation"
XML_QUANTITIES = "quantities"
XML_QUANTITY = "quantity"
XML_EVENT_ID = "event-id"
XML_OBJECT_ID = "object-id"
XML_ITEM = "item"
XML_ITEM_TYPE = "type"
XML_QUANTITY_TYPE = "type"

JSON_QUANTITY_EXTENSION = "quantityExtension"
JSON_OPERATIONS = "operations"
JSON_QUANTITIES = "quantities"

JSON_KEYMAP = {
    EID_COL: "eventId",
    OID_COL: "objectId",
    QEL_ITEM_TYPE: "type",
    QEL_QUANTITY: "quantity",
}

SQL_OPERATIONS = "operation"
SQL_QUANTITIES = "quantity"

SQL_KEYMAP = {
    EID_COL: "ocel_event_id",
    OID_COL: "ocel_object_id",
    QEL_ITEM_TYPE: "type",
    QEL_QUANTITY: "quantity",
}


def inverse_keymap(keymap: dict[str, str]) -> dict[str, str]:
    return {v: k for k, v in keymap.items()}
