"""How the deprecated JSON quantity extension spells its keys.

Only the legacy reader in :mod:`ocelescope.ocel.io.extras.json` uses these: the
current format writes the quantity tables as ordinary extras, with our names.
"""

from ocelescope.ocel.constants.pm4py import EID_COL, OID_COL
from ocelescope.ocel.constants.quantity import (
    QEL_ITEM_TYPE,
    QEL_QUANTITY,
    QUANTITIES_TABLE,
    QUANTITY_ITEM_PROPERTIES_TABLE,
    QUANTITY_OPERATIONS_TABLE,
)

JSON_QUANTITY_EXTENSION = "quantityExtension"
JSON_OPERATIONS = "operations"
JSON_PROPERTIES = "itemTypes"
JSON_QUANTITIES = "quantities"

JSON_KEYMAP = {
    EID_COL: "eventId",
    OID_COL: "objectId",
    QEL_ITEM_TYPE: "type",
    QEL_QUANTITY: "quantity",
}
"""Our column name -> the key the deprecated format spells it with."""

JSON_TABLES = {
    JSON_OPERATIONS: QUANTITY_OPERATIONS_TABLE,
    JSON_QUANTITIES: QUANTITIES_TABLE,
    JSON_PROPERTIES: QUANTITY_ITEM_PROPERTIES_TABLE,
}
"""A list of the deprecated ``quantityExtension`` object -> the quantity table it fills."""
