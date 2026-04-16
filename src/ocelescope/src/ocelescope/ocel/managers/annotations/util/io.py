from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd

from ocelescope.ocel.constants.annotations import (
    ANN_CATEGORY_ID,
    ANN_CATEGORY_VALUE,
    ANN_ELEMENT_REF,
    ANN_ELEMENT_TYPE,
    ANN_ID,
    ANN_LABEL_ID,
    ANN_NAME,
    CATEGORY_ASSIGNMENT_COLUMNS,
    CATEGORY_DEFINITION_COLUMNS,
    LABEL_ASSIGNMENT_COLUMNS,
    LABEL_DEFINITION_COLUMNS,
)
from ocelescope.ocel.managers.annotations.util.constants import (
    SQL_CATEGORY_ASSIGNMENTS_TABLE,
    SQL_CATEGORY_DEFINITIONS_TABLE,
    SQL_LABEL_ASSIGNMENTS_TABLE,
    SQL_LABEL_DEFINITIONS_TABLE,
)


def _q(identifier: str) -> str:
    return f'"{identifier}"'


def _empty(columns: list[str]) -> pd.DataFrame:
    return pd.DataFrame(columns=columns)


def _table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table_name,),
    ).fetchone()
    return row is not None


def _normalize(
    df: pd.DataFrame,
    columns: list[str],
    dtypes: dict[str, type | str],
    sort_by: list[str],
) -> pd.DataFrame:
    if df.empty:
        return _empty(columns)

    missing = [col for col in columns if col not in df.columns]
    if missing:
        raise ValueError(f"DataFrame is missing required columns: {missing}")

    return (
        df[columns].astype(dtypes).drop_duplicates().sort_values(by=sort_by).reset_index(drop=True)
    )


def _read_table(
    conn: sqlite3.Connection,
    table_name: str,
    columns: list[str],
    dtypes: dict[str, type | str],
    sort_by: list[str],
) -> pd.DataFrame:
    if not _table_exists(conn, table_name):
        return _empty(columns)

    query = f"SELECT {', '.join(_q(col) for col in columns)} FROM {table_name}"
    df = pd.read_sql_query(query, conn)
    return _normalize(df, columns=columns, dtypes=dtypes, sort_by=sort_by)


def _ensure_annotation_tables_exist(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(
        f"""
        CREATE TABLE IF NOT EXISTS {SQL_LABEL_DEFINITIONS_TABLE} (
            {_q(ANN_ID)} INTEGER PRIMARY KEY,
            {_q(ANN_ELEMENT_TYPE)} TEXT NOT NULL,
            {_q(ANN_NAME)} TEXT NOT NULL,
            UNIQUE ({_q(ANN_ELEMENT_TYPE)}, {_q(ANN_NAME)})
        );

        CREATE TABLE IF NOT EXISTS {SQL_LABEL_ASSIGNMENTS_TABLE} (
            {_q(ANN_LABEL_ID)} INTEGER NOT NULL,
            {_q(ANN_ELEMENT_REF)} TEXT NOT NULL,
            PRIMARY KEY ({_q(ANN_LABEL_ID)}, {_q(ANN_ELEMENT_REF)}),
            FOREIGN KEY ({_q(ANN_LABEL_ID)})
                REFERENCES {SQL_LABEL_DEFINITIONS_TABLE} ({_q(ANN_ID)})
                ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS {SQL_CATEGORY_DEFINITIONS_TABLE} (
            {_q(ANN_ID)} INTEGER PRIMARY KEY,
            {_q(ANN_ELEMENT_TYPE)} TEXT NOT NULL,
            {_q(ANN_NAME)} TEXT NOT NULL,
            UNIQUE ({_q(ANN_ELEMENT_TYPE)}, {_q(ANN_NAME)})
        );

        CREATE TABLE IF NOT EXISTS {SQL_CATEGORY_ASSIGNMENTS_TABLE} (
            {_q(ANN_CATEGORY_ID)} INTEGER NOT NULL,
            {_q(ANN_ELEMENT_REF)} TEXT NOT NULL,
            {_q(ANN_CATEGORY_VALUE)} TEXT NOT NULL,
            PRIMARY KEY ({_q(ANN_CATEGORY_ID)}, {_q(ANN_ELEMENT_REF)}),
            FOREIGN KEY ({_q(ANN_CATEGORY_ID)})
                REFERENCES {SQL_CATEGORY_DEFINITIONS_TABLE} ({_q(ANN_ID)})
                ON DELETE CASCADE
        );
        """
    )
    conn.commit()


def read_annotations_from_sqlite(
    path: Path,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    with sqlite3.connect(path) as conn:
        conn.execute("PRAGMA foreign_keys = ON")

        label_definitions = _read_table(
            conn,
            SQL_LABEL_DEFINITIONS_TABLE,
            LABEL_DEFINITION_COLUMNS,
            {
                ANN_ID: int,
                ANN_ELEMENT_TYPE: str,
                ANN_NAME: str,
            },
            [ANN_ID],
        )
        label_assignments = _read_table(
            conn,
            SQL_LABEL_ASSIGNMENTS_TABLE,
            LABEL_ASSIGNMENT_COLUMNS,
            {
                ANN_LABEL_ID: int,
                ANN_ELEMENT_REF: str,
            },
            [ANN_LABEL_ID, ANN_ELEMENT_REF],
        )
        category_definitions = _read_table(
            conn,
            SQL_CATEGORY_DEFINITIONS_TABLE,
            CATEGORY_DEFINITION_COLUMNS,
            {
                ANN_ID: int,
                ANN_ELEMENT_TYPE: str,
                ANN_NAME: str,
            },
            [ANN_ID],
        )
        category_assignments = _read_table(
            conn,
            SQL_CATEGORY_ASSIGNMENTS_TABLE,
            CATEGORY_ASSIGNMENT_COLUMNS,
            {
                ANN_CATEGORY_ID: int,
                ANN_ELEMENT_REF: str,
                ANN_CATEGORY_VALUE: str,
            },
            [ANN_CATEGORY_ID, ANN_ELEMENT_REF],
        )

    return (
        label_definitions,
        label_assignments,
        category_definitions,
        category_assignments,
    )


def write_annotations_to_sqlite(
    path: Path,
    label_definitions: pd.DataFrame,
    label_assignments: pd.DataFrame,
    category_definitions: pd.DataFrame,
    category_assignments: pd.DataFrame,
) -> None:
    label_definitions = _normalize(
        label_definitions,
        LABEL_DEFINITION_COLUMNS,
        {
            ANN_ID: int,
            ANN_ELEMENT_TYPE: str,
            ANN_NAME: str,
        },
        [ANN_ID],
    )
    label_assignments = _normalize(
        label_assignments,
        LABEL_ASSIGNMENT_COLUMNS,
        {
            ANN_LABEL_ID: int,
            ANN_ELEMENT_REF: str,
        },
        [ANN_LABEL_ID, ANN_ELEMENT_REF],
    )
    category_definitions = _normalize(
        category_definitions,
        CATEGORY_DEFINITION_COLUMNS,
        {
            ANN_ID: int,
            ANN_ELEMENT_TYPE: str,
            ANN_NAME: str,
        },
        [ANN_ID],
    )
    category_assignments = _normalize(
        category_assignments,
        CATEGORY_ASSIGNMENT_COLUMNS,
        {
            ANN_CATEGORY_ID: int,
            ANN_ELEMENT_REF: str,
            ANN_CATEGORY_VALUE: str,
        },
        [ANN_CATEGORY_ID, ANN_ELEMENT_REF],
    )

    with sqlite3.connect(path) as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        _ensure_annotation_tables_exist(conn)

        conn.execute(f"DELETE FROM {SQL_LABEL_ASSIGNMENTS_TABLE}")
        conn.execute(f"DELETE FROM {SQL_CATEGORY_ASSIGNMENTS_TABLE}")
        conn.execute(f"DELETE FROM {SQL_LABEL_DEFINITIONS_TABLE}")
        conn.execute(f"DELETE FROM {SQL_CATEGORY_DEFINITIONS_TABLE}")

        if not label_definitions.empty:
            label_definitions.to_sql(
                SQL_LABEL_DEFINITIONS_TABLE,
                conn,
                index=False,
                if_exists="append",
            )
        if not label_assignments.empty:
            label_assignments.to_sql(
                SQL_LABEL_ASSIGNMENTS_TABLE,
                conn,
                index=False,
                if_exists="append",
            )
        if not category_definitions.empty:
            category_definitions.to_sql(
                SQL_CATEGORY_DEFINITIONS_TABLE,
                conn,
                index=False,
                if_exists="append",
            )
        if not category_assignments.empty:
            category_assignments.to_sql(
                SQL_CATEGORY_ASSIGNMENTS_TABLE,
                conn,
                index=False,
                if_exists="append",
            )

        conn.commit()


def read_annotations_extension(
    path: Path,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    match path.suffix:
        case ".sqlite":
            return read_annotations_from_sqlite(path)
        case _:
            raise ValueError(f"Unsupported extension: {path.suffix}")


def write_annotations_extension(
    path: Path,
    label_definitions: pd.DataFrame,
    label_assignments: pd.DataFrame,
    category_definitions: pd.DataFrame,
    category_assignments: pd.DataFrame,
) -> None:
    match path.suffix:
        case ".sqlite":
            write_annotations_to_sqlite(
                path,
                label_definitions=label_definitions,
                label_assignments=label_assignments,
                category_definitions=category_definitions,
                category_assignments=category_assignments,
            )
        case _:
            raise ValueError(f"Unsupported extension: {path.suffix}")
