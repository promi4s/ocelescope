from ocelescope import AnnotationElementType
from pydantic import BaseModel


class LabelDefinition(BaseModel):
    id: int
    element_type: AnnotationElementType
    name: str


class LabelAssignment(BaseModel):
    label_id: int
    element_ref: str


class CategoryDefinition(BaseModel):
    id: int
    element_type: AnnotationElementType
    name: str


class CategoryAssignment(BaseModel):
    category_id: int
    element_ref: str
    value: str


class LabelWithAssignments(BaseModel):
    definition: LabelDefinition
    asssignments: list[LabelAssignment]


class CategoryWithAssignments(BaseModel):
    definition: CategoryDefinition
    assignments: list[CategoryAssignment]


class CreateLabelRequest(BaseModel):
    element_type: AnnotationElementType
    name: str


class RenameLabelRequest(BaseModel):
    name: str


class CreateCategoryRequest(BaseModel):
    element_type: AnnotationElementType
    name: str


class RenameCategoryRequest(BaseModel):
    name: str


class SetLabelAssignmentsRequest(BaseModel):
    element_refs: list[str]


class SetCategoryAssignmentsRequest(BaseModel):
    mappings: dict[str, str]


class AddLabelAssignmentRequest(BaseModel):
    element_ref: str


class RemoveLabelAssignmentRequest(BaseModel):
    element_ref: str


class AddCategoryAssignmentRequest(BaseModel):
    element_ref: str
    value: str


class RemoveCategoryAssignmentRequest(BaseModel):
    element_ref: str
