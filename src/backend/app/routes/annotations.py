from fastapi import APIRouter

from app.dependencies import ApiSession
from app.internal.model.annotations import (
    AddCategoryAssignmentRequest,
    AddLabelAssignmentRequest,
    CategoryAssignment,
    CategoryDefinition,
    CategoryWithAssignments,
    CreateCategoryRequest,
    CreateLabelRequest,
    LabelAssignment,
    LabelDefinition,
    LabelWithAssignments,
    RemoveCategoryAssignmentRequest,
    RemoveLabelAssignmentRequest,
    RenameCategoryRequest,
    RenameLabelRequest,
    SetCategoryAssignmentsRequest,
    SetLabelAssignmentsRequest,
)

annotations_router = APIRouter(prefix="/ocels/{ocel_id}/annotations", tags=["ocels"])


# ── Labels ────────────────────────────────────────────────────────────


@annotations_router.get(
    "/labels",
    summary="List all label definitions",
    operation_id="getLabels",
)
def get_labels(
    session: ApiSession,
    ocel_id: str,
) -> list[LabelDefinition]:
    annotations = session.ocels[ocel_id].origin.annotations
    assert annotations is not None
    df = annotations.get_label_definitions()

    return [
        LabelDefinition(
            id=int(row["ann:id"]),
            element_type=row["ann:element_type"],
            name=row["ann:name"],
        )
        for _, row in df.iterrows()
    ]


@annotations_router.get(
    "/labels-with-assignments",
    summary="List all labels including their members",
    operation_id="getLabelsWithAssignments",
)
def get_labels_with_assignments(
    session: ApiSession,
    ocel_id: str,
) -> list[LabelWithAssignments]:
    annotations = session.ocels[ocel_id].origin.annotations
    assert annotations is not None
    items = annotations.get_labels_with_assignments()

    result: list[LabelWithAssignments] = []
    for item in items:
        definition = item["definition"]
        members = item["assignments"]

        result.append(
            LabelWithAssignments(
                definition=LabelDefinition(
                    id=int(definition["ann:id"]),
                    element_type=definition["ann:element_type"],
                    name=definition["ann:name"],
                ),
                asssignments=[
                    LabelAssignment(
                        label_id=int(row["ann:label_id"]),
                        element_ref=row["ann:element_ref"],
                    )
                    for _, row in members.iterrows()
                ],
            )
        )

    return result


@annotations_router.post(
    "/labels",
    summary="Create a label definition",
    operation_id="createLabel",
)
def create_label(
    session: ApiSession,
    ocel_id: str,
    body: CreateLabelRequest,
) -> LabelDefinition:
    annotations = session.ocels[ocel_id].origin.annotations
    assert annotations is not None
    label_id = annotations.create_label(body.element_type, body.name)
    definition = annotations.get_label_definition(label_id)

    return LabelDefinition(
        id=int(definition["ann:id"]),
        element_type=definition["ann:element_type"],
        name=definition["ann:name"],
    )


@annotations_router.patch(
    "/labels/{label_id}",
    summary="Rename a label definition",
    operation_id="renameLabel",
)
def rename_label(
    session: ApiSession,
    ocel_id: str,
    label_id: int,
    body: RenameLabelRequest,
) -> LabelDefinition:
    annotations = session.ocels[ocel_id].origin.annotations
    assert annotations is not None
    annotations.rename_label(label_id, body.name)
    definition = annotations.get_label_definition(label_id)

    return LabelDefinition(
        id=int(definition["ann:id"]),
        element_type=definition["ann:element_type"],
        name=definition["ann:name"],
    )


@annotations_router.delete(
    "/labels/{label_id}",
    summary="Delete a label definition",
    operation_id="deleteLabel",
)
def delete_label(
    session: ApiSession,
    ocel_id: str,
    label_id: int,
) -> None:
    annotations = session.ocels[ocel_id].origin.annotations
    assert annotations is not None
    annotations.delete_label(label_id)


@annotations_router.get(
    "/labels/{label_id}/assignments",
    summary="Get members of a label",
    operation_id="getLabelAssignments",
)
def get_label_assignments(
    session: ApiSession,
    ocel_id: str,
    label_id: int,
) -> list[LabelAssignment]:
    annotations = session.ocels[ocel_id].origin.annotations
    assert annotations is not None
    df = annotations.get_label_assignments(label_id)

    return [
        LabelAssignment(
            label_id=int(row["ann:label_id"]),
            element_ref=row["ann:element_ref"],
        )
        for _, row in df.iterrows()
    ]


@annotations_router.put(
    "/labels/{label_id}/assignements",
    summary="Replace all members of a label",
    operation_id="setLabelAssignments",
)
def set_label_assignments(
    session: ApiSession,
    ocel_id: str,
    label_id: int,
    body: SetLabelAssignmentsRequest,
) -> None:
    annotations = session.ocels[ocel_id].origin.annotations
    assert annotations is not None
    annotations.set_label_assignments(label_id, body.element_refs)


@annotations_router.post(
    "/labels/{label_id}/assignments",
    summary="Add one member to a label",
    operation_id="addLabelAssignment",
)
def add_label_assignment(
    session: ApiSession,
    ocel_id: str,
    label_id: int,
    body: AddLabelAssignmentRequest,
) -> None:
    annotations = session.ocels[ocel_id].origin.annotations
    assert annotations is not None
    annotations.add_label_assignment(label_id, body.element_ref)


@annotations_router.delete(
    "/labels/{label_id}/assignments",
    summary="Remove one member from a label",
    operation_id="removeLabelAssignment",
)
def remove_label_assignment(
    session: ApiSession,
    ocel_id: str,
    label_id: int,
    body: RemoveLabelAssignmentRequest,
) -> None:
    annotations = session.ocels[ocel_id].origin.annotations
    assert annotations is not None
    annotations.remove_label_assignment(label_id, body.element_ref)


# ── Categories ────────────────────────────────────────────────────────


@annotations_router.get(
    "/categories",
    summary="List all category definitions",
    operation_id="getCategories",
)
def get_categories(
    session: ApiSession,
    ocel_id: str,
) -> list[CategoryDefinition]:
    annotations = session.ocels[ocel_id].origin.annotations
    assert annotations is not None
    df = annotations.get_category_definitions()

    return [
        CategoryDefinition(
            id=int(row["ann:id"]),
            element_type=row["ann:element_type"],
            name=row["ann:name"],
        )
        for _, row in df.iterrows()
    ]


@annotations_router.get(
    "/categories-with-assignments",
    summary="List all categories including their assignments",
    operation_id="getCategoriesWithAssignments",
)
def get_categories_with_assignments(
    session: ApiSession,
    ocel_id: str,
) -> list[CategoryWithAssignments]:
    annotations = session.ocels[ocel_id].origin.annotations
    assert annotations is not None
    items = annotations.get_categories_with_assignments()

    result: list[CategoryWithAssignments] = []
    for item in items:
        definition = item["definition"]
        assignments = item["assignments"]

        result.append(
            CategoryWithAssignments(
                definition=CategoryDefinition(
                    id=int(definition["ann:id"]),
                    element_type=definition["ann:element_type"],
                    name=definition["ann:name"],
                ),
                assignments=[
                    CategoryAssignment(
                        category_id=int(row["ann:category_id"]),
                        element_ref=row["ann:element_ref"],
                        value=row["ann:category_value"],
                    )
                    for _, row in assignments.iterrows()
                ],
            )
        )

    return result


@annotations_router.post(
    "/categories",
    summary="Create a category definition",
    operation_id="createCategory",
)
def create_category(
    session: ApiSession,
    ocel_id: str,
    body: CreateCategoryRequest,
) -> CategoryDefinition:
    annotations = session.ocels[ocel_id].origin.annotations
    assert annotations is not None
    category_id = annotations.create_category(body.element_type, body.name)
    definition = annotations.get_category_definition(category_id)

    return CategoryDefinition(
        id=int(definition["ann:id"]),
        element_type=definition["ann:element_type"],
        name=definition["ann:name"],
    )


@annotations_router.patch(
    "/categories/{category_id}",
    summary="Rename a category definition",
    operation_id="renameCategory",
)
def rename_category(
    session: ApiSession,
    ocel_id: str,
    category_id: int,
    body: RenameCategoryRequest,
) -> CategoryDefinition:
    annotations = session.ocels[ocel_id].origin.annotations
    assert annotations is not None
    annotations.rename_category(category_id, body.name)
    definition = annotations.get_category_definition(category_id)

    return CategoryDefinition(
        id=int(definition["ann:id"]),
        element_type=definition["ann:element_type"],
        name=definition["ann:name"],
    )


@annotations_router.delete(
    "/categories/{category_id}",
    summary="Delete a category definition",
    operation_id="deleteCategory",
)
def delete_category(
    session: ApiSession,
    ocel_id: str,
    category_id: int,
) -> None:
    annotations = session.ocels[ocel_id].origin.annotations
    assert annotations is not None
    annotations.delete_category(category_id)


@annotations_router.get(
    "/categories/{category_id}/assignments",
    summary="Get assignments of a category",
    operation_id="getCategoryAssignments",
)
def get_category_assignments(
    session: ApiSession,
    ocel_id: str,
    category_id: int,
) -> list[CategoryAssignment]:
    annotations = session.ocels[ocel_id].origin.annotations
    assert annotations is not None
    df = annotations.get_category_assignments(category_id)

    return [
        CategoryAssignment(
            category_id=int(row["ann:category_id"]),
            element_ref=row["ann:element_ref"],
            value=row["ann:category_value"],
        )
        for _, row in df.iterrows()
    ]


@annotations_router.put(
    "/categories/{category_id}/assignments",
    summary="Replace all assignments of a category",
    operation_id="setCategoryAssignments",
)
def set_category_assignments(
    session: ApiSession,
    ocel_id: str,
    category_id: int,
    body: SetCategoryAssignmentsRequest,
) -> None:
    annotations = session.ocels[ocel_id].origin.annotations
    assert annotations is not None
    annotations.set_category_assignments(category_id, body.mappings)


@annotations_router.post(
    "/categories/{category_id}/assignments",
    summary="Set one category value",
    operation_id="addCategoryAssignment",
)
def add_category_assignment(
    session: ApiSession,
    ocel_id: str,
    category_id: int,
    body: AddCategoryAssignmentRequest,
) -> None:
    annotations = session.ocels[ocel_id].origin.annotations
    assert annotations is not None
    annotations.add_category_assignment(category_id, body.element_ref, body.value)


@annotations_router.delete(
    "/categories/{category_id}/assignments",
    summary="Remove one category value",
    operation_id="removeCategoryAssignment",
)
def remove_category_assignment(
    session: ApiSession,
    ocel_id: str,
    category_id: int,
    body: RemoveCategoryAssignmentRequest,
) -> None:
    annotations = session.ocels[ocel_id].origin.annotations
    assert annotations is not None
    annotations.remove_category_assignment(category_id, body.element_ref)
