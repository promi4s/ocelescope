from typing import Any, List, Literal, Optional

from pydantic import BaseModel

from ocelescope.visualization.visualization import Visualization

TableDataType = Literal["string", "number", "boolean", "date", "datetime"]


class TableColumn(BaseModel):
    """Column definition for a `Table` visualization.

    Attributes:
        id: Column id (used as key in each row dict).
        label: Optional human-readable column label.
        data_type: Column data type (for example `"string"` or `"number"`).
        sortable: Whether the column can be sorted in the frontend.
        visible: Whether the column is visible by default.
    """

    id: str
    label: Optional[str] = None
    data_type: TableDataType = "string"
    sortable: bool = True
    visible: bool = True


class Table(Visualization):
    """Tabular visualization with typed columns and row data.

    Rows are dictionaries keyed by `TableColumn.id`.

    Attributes:
        type: Fixed discriminator `"table"`.
        columns: Column definitions.
        rows: List of row dicts.
    """

    type: Literal["table"] = "table"
    columns: List[TableColumn]
    rows: List[dict[str, Any]]
