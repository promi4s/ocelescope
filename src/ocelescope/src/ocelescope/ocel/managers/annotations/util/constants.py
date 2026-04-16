from ocelescope.ocel.constants.annotations import (
    ANN_CATEGORY_ID,
    ANN_CATEGORY_VALUE,
    ANN_ELEMENT_REF,
    ANN_ELEMENT_TYPE,
    ANN_ID,
    ANN_LABEL_ID,
    ANN_NAME,
)

SQL_LABEL_DEFINITIONS_TABLE = "ocelescope_label_definitions"
SQL_LABEL_ASSIGNMENTS_TABLE = "ocelescope_label_assignments"

SQL_CATEGORY_DEFINITIONS_TABLE = "ocelescope_category_definitions"
SQL_CATEGORY_ASSIGNMENTS_TABLE = "ocelescope_category_assignments"

JSON_ANNOTATION_EXTENSION = "annotationExtension"
JSON_LABEL_DEFINITIONS = "labelDefinitions"
JSON_LABEL_ASSIGNMENTS = "labelAssignments"
JSON_CATEGORY_DEFINITIONS = "categoryDefinitions"
JSON_CATEGORY_ASSIGNMENTS = "categoryAssignments"

JSON_LABEL_DEFINITION_KEYMAP = {
    ANN_ID: "id",
    ANN_ELEMENT_TYPE: "elementType",
    ANN_NAME: "name",
}
JSON_LABEL_ASSIGNMENT_KEYMAP = {
    ANN_LABEL_ID: "labelId",
    ANN_ELEMENT_REF: "elementRef",
}
JSON_CATEGORY_DEFINITION_KEYMAP = {
    ANN_ID: "id",
    ANN_ELEMENT_TYPE: "elementType",
    ANN_NAME: "name",
}
JSON_CATEGORY_ASSIGNMENT_KEYMAP = {
    ANN_CATEGORY_ID: "categoryId",
    ANN_ELEMENT_REF: "elementRef",
    ANN_CATEGORY_VALUE: "value",
}

XML_ANNOTATION_EXTENSION = "annotation-extension"

XML_LABEL_DEFINITIONS = "label-definitions"
XML_LABEL_DEFINITION = "label-definition"
XML_LABEL_ASSIGNMENTS = "label-assignments"
XML_LABEL_ASSIGNMENT = "label-assignment"

XML_CATEGORY_DEFINITIONS = "category-definitions"
XML_CATEGORY_DEFINITION = "category-definition"
XML_CATEGORY_ASSIGNMENTS = "category-assignments"
XML_CATEGORY_ASSIGNMENT = "category-assignment"

XML_ID = "id"
XML_ELEMENT_TYPE = "element-type"
XML_NAME = "name"
XML_LABEL_ID = "label-id"
XML_CATEGORY_ID = "category-id"
XML_ELEMENT_REF = "element-ref"
XML_VALUE = "value"


def inverse_keymap(keymap: dict[str, str]) -> dict[str, str]:
    return {v: k for k, v in keymap.items()}
