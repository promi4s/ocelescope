from __future__ import annotations

from typing import Any

import duckdb
import pandas as pd
import polars

from ocelescope.ocel.constants.pm4py import (
    O2O_QUALIFIER,
    O2O_SOURCE_ID,
    O2O_SOURCE_TYPE,
    O2O_TARGET_ID,
    O2O_TARGET_TYPE,
    OID_COL,
    OTYPE_COL,
)
from ocelescope.ocel.managers.base import BaseManager

TABLE = "o2o"
_OBJECTS_TABLE = "objects"


class O2OManager(BaseManager):
    """
    Manages object-to-object (O2O) relations within an OCEL instance.

    Provides:
        - Access to the raw O2O relation table
        - A normalized O2O table using canonical constant column names
        - Type-enriched O2O relations (joining object types)
        - Aggregated summaries of O2O relation multiplicities

    This manager acts as a typed and normalized facade over the
    PM4PY O2O relation table.
    """

    @property
    def table(self) -> duckdb.DuckDBPyRelation:
        """
        Return the O2O relation table as a lazy DuckDB relation.

        Columns follow the canonical constants (O2O_SOURCE_ID, O2O_TARGET_ID,
        O2O_QUALIFIER), which is how the table is stored -- so nothing is derived
        here and assigning it back is a straight replace.

        Returns:
            DuckDBPyRelation: A lazy relation over all O2O relations.
        """
        return self._relation(
            f'SELECT "{O2O_SOURCE_ID}", "{O2O_TARGET_ID}", "{O2O_QUALIFIER}" FROM {TABLE}'
        )

    @table.setter
    def table(self, contents: Any) -> None:
        self._replace(TABLE, contents)

    @property
    def df(self) -> pd.DataFrame:
        """
        Return the O2O relation table with normalized column names.

        Read from the OCEL's DuckDB database on every access. The source and
        target objects are named by the canonical constants:

            - O2O_SOURCE_ID
            - O2O_TARGET_ID

        Returns:
            DataFrame: A normalized O2O relation table.
        """
        return self.table.df()

    @df.setter
    def df(self, contents: pd.DataFrame) -> None:
        self._replace(TABLE, contents)

    @property
    def pl(self) -> polars.LazyFrame:
        """
        Return the O2O relation table as a polars LazyFrame.

        Nothing is read until it is collected.

        Each access is its own scan, bound to its own cursor -- so read it freshly
        at each use rather than storing it in a variable and reusing it. One
        LazyFrame cannot be read twice within a single query.

        Returns:
            polars.LazyFrame: A normalized O2O relation table.
        """
        return self.table.pl(lazy=True)

    @pl.setter
    def pl(self, contents: polars.LazyFrame | polars.DataFrame) -> None:
        self._replace(TABLE, contents)

    @property
    def typed_table(self) -> duckdb.DuckDBPyRelation:
        """
        Return the O2O relations with each end's object type joined on, lazily.

        Adds two columns to the normalized O2O table:

            - O2O_SOURCE_TYPE
            - O2O_TARGET_TYPE

        The joins are outer, so a relation naming an object the log does not have
        keeps its row and gets a null type rather than disappearing.

        Returns:
            DuckDBPyRelation: A lazy relation over the type-enriched O2O table.
        """
        return self._relation(
            f'SELECT r.*, s."{OTYPE_COL}" AS "{O2O_SOURCE_TYPE}", '
            f't."{OTYPE_COL}" AS "{O2O_TARGET_TYPE}" '
            f'FROM (SELECT "{O2O_SOURCE_ID}", "{O2O_TARGET_ID}", "{O2O_QUALIFIER}" '
            f"FROM {TABLE}) r "
            f'LEFT JOIN {_OBJECTS_TABLE} s ON r."{O2O_SOURCE_ID}" = s."{OID_COL}" '
            f'LEFT JOIN {_OBJECTS_TABLE} t ON r."{O2O_TARGET_ID}" = t."{OID_COL}"'
        )

    @property
    def typed_pl(self) -> polars.LazyFrame:
        """
        Return the type-enriched O2O relation table as a polars LazyFrame.

        Returns:
            polars.LazyFrame: A type-enriched O2O relation table.
        """
        return self.typed_table.pl(lazy=True)

    @property
    def typed_df(self) -> pd.DataFrame:
        """
        Return the O2O relation table enriched with object types.

        Returns:
            DataFrame: A type-enriched O2O relation table.
        """
        return self.typed_table.df()

    @property
    def qualifiers(self) -> list[str]:
        """
        Return the list of all qualifiers present in the O2O relations.

        Returns:
            list[str]: Sorted list of unique qualifier names.
        """
        return self._column(
            f'SELECT DISTINCT "{O2O_QUALIFIER}" FROM {TABLE} '
            f'WHERE "{O2O_QUALIFIER}" IS NOT NULL ORDER BY 1'
        )
