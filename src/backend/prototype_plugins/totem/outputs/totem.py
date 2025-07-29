from pydantic import BaseModel
from typing import Literal, Optional

from outputs import OutputBase, register_output


Temporal_Relation_Constant = Literal["D", "Di", "I", "Ii", "P"]

Cardinality = Literal["0", "1", "0...1", "1..*", "0...*"]


class TotemEdge(BaseModel):
    source: str
    target: str
    lc: Optional[Cardinality]
    lc_inverse: Optional[Cardinality]
    ec: Optional[Cardinality]
    ec_inverse: Optional[Cardinality]
    tr: Optional[Temporal_Relation_Constant]
    tr_inverse: Optional[Temporal_Relation_Constant]


@register_output(label="TOTem")
class Totem(OutputBase):
    object_types: list[str]
    edges: list[TotemEdge]
    type: Literal["totem"] = "totem"
