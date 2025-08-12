from typing import Any, List, Literal, Optional
from pydantic import BaseModel

TableDataType = Literal["string", "number", "boolean", "date", "datetime"]


class TableColumn(BaseModel):
    id: str
    label: Optional[str] = None
    data_type: TableDataType = "string"
    sortable: bool = True
    visible: bool = True


class Table(BaseModel):
    type: Literal["table"]
    columns: List[TableColumn]
    rows: List[dict[str, Any]]
