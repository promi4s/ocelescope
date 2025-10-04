from typing import Any, List, Literal, Optional
from pydantic import BaseModel

from ocelescope.visualization.visualization import Visualization

TableDataType = Literal["string", "number", "boolean", "date", "datetime"]


class TableColumn(BaseModel):
    id: str
    label: Optional[str] = None
    data_type: TableDataType = "string"
    sortable: bool = True
    visible: bool = True


class Table(Visualization):
    type: Literal["table"] = "table"
    columns: List[TableColumn]
    rows: List[dict[str, Any]]
