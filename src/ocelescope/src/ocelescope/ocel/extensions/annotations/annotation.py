from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

import pandas as pd

from ocelescope.ocel.constants.annotations import (
    ANN_CATEGORY_ID,
    ANN_CATEGORY_VALUE,
    ANN_ELEMENT_REF,
    ANN_ELEMENT_TYPE,
    ANN_ID,
    ANN_LABEL_ID,
    ANN_NAME,
    AnnotationElementType,
)
from ocelescope.ocel.extensions.annotations.util.io import (
    read_annotations_extension,
    write_annotations_extension,
)
from ocelescope.ocel.extensions.base_extension import OCELExtension

if TYPE_CHECKING:
    from ocelescope.ocel.core import OCEL


class AnnotationExtension(OCELExtension):
    name = "Annotations"
    description = "Reads and stores annotations from an SQLite file. Annotations are labeles and categories that are created for objects, object types, events and activities to group them."
    version = "1.0"
    supported_extensions = [".sqlite"]

    def __init__(
        self,
        ocel: OCEL,
        label_definitions: pd.DataFrame,
        label_assignments: pd.DataFrame,
        category_definitions: pd.DataFrame,
        category_assignments: pd.DataFrame,
    ):
        self.ocel = ocel
        self.label_definitions = label_definitions
        self.label_assignments = label_assignments
        self.category_definitions = category_definitions
        self.category_assignments = category_assignments

    @staticmethod
    def has_extension(path: Path) -> bool:
        return path.suffix in AnnotationExtension.supported_extensions

    @classmethod
    def import_extension(cls, ocel: OCEL, path: Path) -> "AnnotationExtension":
        return cls(ocel, *read_annotations_extension(path))

    def export_extension(self, path: Path) -> None:
        write_annotations_extension(
            path,
            self.label_definitions,
            self.label_assignments,
            self.category_definitions,
            self.category_assignments,
        )

    def _find_label_id(self, element_type: AnnotationElementType, name: str) -> int | None:
        matches = self.label_definitions.loc[
            (self.label_definitions[ANN_ELEMENT_TYPE] == element_type)
            & (self.label_definitions[ANN_NAME] == name)
        ]
        return None if matches.empty else int(matches.iloc[0][ANN_ID])

    def _find_category_id(self, element_type: AnnotationElementType, name: str) -> int | None:
        matches = self.category_definitions.loc[
            (self.category_definitions[ANN_ELEMENT_TYPE] == element_type)
            & (self.category_definitions[ANN_NAME] == name)
        ]
        return None if matches.empty else int(matches.iloc[0][ANN_ID])

    # Labels

    def get_label_definitions(self) -> pd.DataFrame:
        return self.label_definitions.reset_index(drop=True)

    def get_label_definition(self, label_id: int) -> pd.Series:
        row = self.label_definitions.loc[self.label_definitions[ANN_ID] == label_id]
        if row.empty:
            raise KeyError(f"Unknown label id: {label_id}")
        return row.iloc[0]

    def create_label(self, element_type: AnnotationElementType, name: str) -> int:
        existing = self._find_label_id(element_type=element_type, name=name)
        if existing is not None:
            return existing

        label_id = (
            1 if self.label_definitions.empty else int(self.label_definitions[ANN_ID].max()) + 1
        )
        new_row = pd.DataFrame([{ANN_ID: label_id, ANN_ELEMENT_TYPE: element_type, ANN_NAME: name}])
        self.label_definitions = pd.concat([self.label_definitions, new_row], ignore_index=True)
        return label_id

    def rename_label(self, label_id: int, new_name: str) -> None:
        row = self.get_label_definition(label_id)
        element_type = row[ANN_ELEMENT_TYPE]

        duplicate = self.label_definitions.loc[
            (self.label_definitions[ANN_ID] != label_id)
            & (self.label_definitions[ANN_ELEMENT_TYPE] == element_type)
            & (self.label_definitions[ANN_NAME] == new_name)
        ]
        if not duplicate.empty:
            raise ValueError(
                f"Label with name '{new_name}' already exists for element type '{element_type}'."
            )

        self.label_definitions.loc[self.label_definitions[ANN_ID] == label_id, ANN_NAME] = str(
            new_name
        )

    def delete_label(self, label_id: int) -> None:
        self.label_definitions = self.label_definitions.loc[
            self.label_definitions[ANN_ID] != label_id
        ].reset_index(drop=True)
        self.label_assignments = self.label_assignments.loc[
            self.label_assignments[ANN_LABEL_ID] != label_id
        ].reset_index(drop=True)

    def get_label_assignments(self, label_id: int) -> pd.DataFrame:
        return self.label_assignments.loc[
            self.label_assignments[ANN_LABEL_ID] == label_id
        ].reset_index(drop=True)

    def get_labels_with_assignments(self) -> list[dict[str, pd.Series | pd.DataFrame]]:
        result: list[dict[str, pd.Series | pd.DataFrame]] = []

        for _, definition in self.label_definitions.sort_values(by=ANN_ID).iterrows():
            label_id = int(definition[ANN_ID])
            assignments = self.get_label_assignments(label_id)
            result.append(
                {
                    "definition": definition.copy(),
                    "assignments": assignments,
                }
            )

        return result

    def add_label_assignment(self, label_id: int, element_ref: str) -> None:
        mask = (self.label_assignments[ANN_LABEL_ID] == label_id) & (
            self.label_assignments[ANN_ELEMENT_REF] == element_ref
        )
        self.label_assignments = self.label_assignments.loc[~mask].reset_index(drop=True)

        new_row = pd.DataFrame(
            [
                {
                    ANN_LABEL_ID: label_id,
                    ANN_ELEMENT_REF: str(element_ref),
                }
            ]
        )
        self.label_assignments = pd.concat([self.label_assignments, new_row], ignore_index=True)

    def remove_label_assignment(self, label_id: int, element_ref: str) -> None:
        mask = (self.label_assignments[ANN_LABEL_ID] == label_id) & (
            self.label_assignments[ANN_ELEMENT_REF] == element_ref
        )
        self.label_assignments = self.label_assignments.loc[~mask].reset_index(drop=True)

    def set_label_assignments(self, label_id: int, element_refs: list[str]) -> None:
        self.label_assignments = self.label_assignments.loc[
            self.label_assignments[ANN_LABEL_ID] != label_id
        ].reset_index(drop=True)

        if not element_refs:
            return

        new_rows = pd.DataFrame(
            {
                ANN_LABEL_ID: label_id,
                ANN_ELEMENT_REF: [str(e) for e in element_refs],
            }
        )
        self.label_assignments = pd.concat([self.label_assignments, new_rows], ignore_index=True)

    # Categories

    def get_category_definitions(self) -> pd.DataFrame:
        return self.category_definitions.reset_index(drop=True)

    def get_category_definition(self, category_id: int) -> pd.Series:
        row = self.category_definitions.loc[self.category_definitions[ANN_ID] == category_id]
        if row.empty:
            raise KeyError(f"Unknown category id: {category_id}")
        return row.iloc[0]

    def create_category(self, element_type: AnnotationElementType, name: str) -> int:
        existing = self._find_category_id(element_type=element_type, name=name)
        if existing is not None:
            return existing

        category_id = (
            1
            if self.category_definitions.empty
            else int(self.category_definitions[ANN_ID].max()) + 1
        )
        new_row = pd.DataFrame(
            [{ANN_ID: category_id, ANN_ELEMENT_TYPE: element_type, ANN_NAME: name}]
        )
        self.category_definitions = pd.concat(
            [self.category_definitions, new_row], ignore_index=True
        )
        return category_id

    def rename_category(self, category_id: int, new_name: str) -> None:
        row = self.get_category_definition(category_id)
        element_type = row[ANN_ELEMENT_TYPE]

        duplicate = self.category_definitions.loc[
            (self.category_definitions[ANN_ID] != category_id)
            & (self.category_definitions[ANN_ELEMENT_TYPE] == element_type)
            & (self.category_definitions[ANN_NAME] == new_name)
        ]
        if not duplicate.empty:
            raise ValueError(
                f"Category with name '{new_name}' already exists for element type '{element_type}'."
            )

        self.category_definitions.loc[
            self.category_definitions[ANN_ID] == category_id, ANN_NAME
        ] = str(new_name)

    def delete_category(self, category_id: int) -> None:
        self.category_definitions = self.category_definitions.loc[
            self.category_definitions[ANN_ID] != category_id
        ].reset_index(drop=True)
        self.category_assignments = self.category_assignments.loc[
            self.category_assignments[ANN_CATEGORY_ID] != category_id
        ].reset_index(drop=True)

    def get_category_assignments(self, category_id: int) -> pd.DataFrame:
        return self.category_assignments.loc[
            self.category_assignments[ANN_CATEGORY_ID] == category_id
        ].reset_index(drop=True)

    def get_categories_with_assignments(self) -> list[dict[str, pd.Series | pd.DataFrame]]:
        result: list[dict[str, pd.Series | pd.DataFrame]] = []

        for _, definition in self.category_definitions.sort_values(by=ANN_ID).iterrows():
            category_id = int(definition[ANN_ID])
            assignments = self.get_category_assignments(category_id)
            result.append(
                {
                    "definition": definition.copy(),
                    "assignments": assignments,
                }
            )

        return result

    def add_category_assignment(self, category_id: int, element_ref: str, value: str) -> None:
        mask = (self.category_assignments[ANN_CATEGORY_ID] == category_id) & (
            self.category_assignments[ANN_ELEMENT_REF] == element_ref
        )
        self.category_assignments = self.category_assignments.loc[~mask].reset_index(drop=True)

        new_row = pd.DataFrame(
            [
                {
                    ANN_CATEGORY_ID: category_id,
                    ANN_ELEMENT_REF: str(element_ref),
                    ANN_CATEGORY_VALUE: str(value),
                }
            ]
        )
        self.category_assignments = pd.concat(
            [self.category_assignments, new_row], ignore_index=True
        )

    def remove_category_assignment(self, category_id: int, element_ref: str) -> None:
        mask = (self.category_assignments[ANN_CATEGORY_ID] == category_id) & (
            self.category_assignments[ANN_ELEMENT_REF] == element_ref
        )
        self.category_assignments = self.category_assignments.loc[~mask].reset_index(drop=True)

    def set_category_assignments(self, category_id: int, mapping: dict[str, str]) -> None:
        self.category_assignments = self.category_assignments.loc[
            self.category_assignments[ANN_CATEGORY_ID] != category_id
        ].reset_index(drop=True)

        if not mapping:
            return

        new_rows = pd.DataFrame(
            [
                {
                    ANN_CATEGORY_ID: category_id,
                    ANN_ELEMENT_REF: str(element_ref),
                    ANN_CATEGORY_VALUE: str(value),
                }
                for element_ref, value in mapping.items()
            ]
        )
        self.category_assignments = pd.concat(
            [self.category_assignments, new_rows], ignore_index=True
        )
