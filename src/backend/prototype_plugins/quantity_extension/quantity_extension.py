from pathlib import Path
from typing import Optional

from pandas import DataFrame
from ocelescope import OCELExtension

from .util import get_table_from_sqlite, get_table_names_from_sqlite
from util.types import PathLike


TABLE_EQTY = "quantity_operations"
TABLE_OBJECT_QTY = "object_quantity"


class QELExtension(OCELExtension):
    name = "QEL Extension"
    description = "Handles quantity-based tables stored in OCEL SQLite logs."
    version = "1.0"
    supported_extensions = [".sqlite"]

    def __init__(
        self,
        eqty_table: Optional[DataFrame] = None,
        object_qty_table: Optional[DataFrame] = None,
    ):
        self.eqty_table = eqty_table
        self.object_qty_table = object_qty_table

    @staticmethod
    def has_extension(path: Path) -> bool:
        table_names = get_table_names_from_sqlite(path)
        return TABLE_EQTY in table_names or TABLE_OBJECT_QTY in table_names

    @classmethod
    def import_extension(cls, path: Path) -> "QELExtension":
        eqty_table = get_table_from_sqlite(path, TABLE_EQTY)
        object_qty_table = get_table_from_sqlite(path, TABLE_OBJECT_QTY)
        return cls(eqty_table=eqty_table, object_qty_table=object_qty_table)

    def export_extension(self, path: PathLike) -> None:
        # You would need to implement the logic for writing these tables back to SQLite
        raise NotImplementedError("Export not yet implemented.")
