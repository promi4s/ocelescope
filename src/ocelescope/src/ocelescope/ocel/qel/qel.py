import duckdb

from ocelescope.ocel.constants.pm4py import EID_COL, OID_COL
from ocelescope.ocel.constants.quantity import (
    QEL_ITEM_TYPE,
    QEL_QUANTITY,
    QUANTITIES_TABLE,
    QUANTITY_ITEM_PROPERTIES_TABLE,
    QUANTITY_OPERATIONS_TABLE,
)
from ocelescope.ocel.core import OCEL
from ocelescope.ocel.extension import Extension
from ocelescope.ocel.qel.quantities import QuantityManager


class QEL(OCEL):
    """An OCEL whose objects carry quantities of items, which events change.

    It is an :class:`OCEL` in every respect and adds ``quantities``. Open one like
    any log (``QEL.read(path)``), or view a log already open as one
    (``QEL.from_ocel(ocel)``). Assigning to a quantity table creates it, which is
    also how a log without quantities is given some.

    Attributes:
        quantities (QuantityManager):
            The quantity tables and what is read off them: who is involved in a
            quantity, and how an object's item levels develop over time.
    """

    extension = Extension(
        name="qel",
        label="QEL",
        tables={
            QUANTITY_OPERATIONS_TABLE: [
                (EID_COL, "VARCHAR"),
                (OID_COL, "VARCHAR"),
                (QEL_ITEM_TYPE, "VARCHAR"),
                (QEL_QUANTITY, "DOUBLE"),
            ],
            QUANTITIES_TABLE: [
                (OID_COL, "VARCHAR"),
                (QEL_ITEM_TYPE, "VARCHAR"),
                (QEL_QUANTITY, "DOUBLE"),
            ],
            QUANTITY_ITEM_PROPERTIES_TABLE: [(QEL_ITEM_TYPE, "VARCHAR")],
        },
        # a file does not store an empty table, so a log may have any one of them
        optional=(
            QUANTITY_OPERATIONS_TABLE,
            QUANTITIES_TABLE,
            QUANTITY_ITEM_PROPERTIES_TABLE,
        ),
    )

    def __init__(self, connection: duckdb.DuckDBPyConnection) -> None:
        super().__init__(connection)
        self._quantities = QuantityManager(self)

    @property
    def quantities(self) -> QuantityManager:
        return self._quantities
