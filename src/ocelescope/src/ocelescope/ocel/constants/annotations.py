from typing import Literal

AnnotationElementType = Literal["event", "activity", "object", "object_type", "item_type"]

ANN_ID = "ann:id"
ANN_ELEMENT_TYPE = "ann:element_type"
ANN_NAME = "ann:name"
ANN_ELEMENT_REF = "ann:element_ref"

ANN_LABEL_ID = "ann:label_id"

ANN_CATEGORY_ID = "ann:category_id"
ANN_CATEGORY_VALUE = "ann:category_value"


LABEL_DEFINITION_COLUMNS = [ANN_ID, ANN_ELEMENT_TYPE, ANN_NAME]
LABEL_ASSIGNMENT_COLUMNS = [ANN_LABEL_ID, ANN_ELEMENT_REF]

CATEGORY_DEFINITION_COLUMNS = [ANN_ID, ANN_ELEMENT_TYPE, ANN_NAME]
CATEGORY_ASSIGNMENT_COLUMNS = [ANN_CATEGORY_ID, ANN_ELEMENT_REF, ANN_CATEGORY_VALUE]
