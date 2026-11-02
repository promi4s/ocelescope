from pathlib import Path
from typing import Self

import duckdb

from ocelescope.ocel.constants import (
    E2O_QUALIFIER,
    EID_COL,
    O2O_QUALIFIER,
    O2O_SOURCE_ID,
    O2O_TARGET_ID,
    OID_COL,
)
from ocelescope.resource.tabular import Table, TabularResource
from ocelescope.util.sql import ident, literal

_CSV_TABLES: list[tuple[str, list[str], str | None]] = [
    ("e2o", [EID_COL, OID_COL], E2O_QUALIFIER),
    ("o2o", [O2O_SOURCE_ID, O2O_TARGET_ID], O2O_QUALIFIER),
    ("objects", [OID_COL], None),
    ("events", [EID_COL], None),
]


class OCELMapping(TabularResource):
    """Objects, events and relations of an OCEL, listed by id.

    The ids alone select those entities; any further columns of a table map them
    to values. Any of the tables may be empty. A relation whose qualifier is NULL
    stands for that relation under any qualifier.
    """

    label = "OCEL Mapping"
    description = (
        "Objects, events and relations of an OCEL, optionally mapped to values"
    )

    objects = Table([(OID_COL, "str")], extra_columns="keep")
    events = Table([(EID_COL, "str")], extra_columns="keep")
    e2o = Table(
        [(EID_COL, "str"), (OID_COL, "str"), (E2O_QUALIFIER, "str")],
        extra_columns="keep",
    )
    o2o = Table(
        [(O2O_SOURCE_ID, "str"), (O2O_TARGET_ID, "str"), (O2O_QUALIFIER, "str")],
        extra_columns="keep",
    )

    @classmethod
    def from_csv(cls, path: str | Path) -> Self:
        """A mapping filling the one table the CSV at ``path`` has the columns of.

        The columns are the OCEL's own (``ocel:oid``, ``ocel:eid``, ...); a
        relation's qualifier may be left out. Any other column is kept, with its
        type detected from the CSV.

        Raises:
            ValueError: If the CSV fits no table, or lists nothing.
        """
        source = literal(str(path))
        con = duckdb.connect(":memory:")
        try:
            try:
                columns = con.sql(
                    f"FROM read_csv({source}, header = true, all_varchar = true)"
                ).columns

                for table, required, qualifier in _CSV_TABLES:
                    if not set(required) <= set(columns):
                        continue
                    text_columns = [
                        *required,
                        *([qualifier] if qualifier in columns else []),
                    ]
                    types = ", ".join(f"{literal(c)}: 'VARCHAR'" for c in text_columns)
                    missing_qualifier = (
                        f", NULL AS {ident(qualifier)}"
                        if qualifier is not None and qualifier not in columns
                        else ""
                    )
                    data = (
                        con.sql(
                            f"SELECT DISTINCT *{missing_qualifier} "
                            f"FROM read_csv({source}, header = true, sample_size = -1, types = {{{types}}}) "
                            f"WHERE {' AND '.join(f'{ident(c)} IS NOT NULL' for c in required)}"
                        )
                        .arrow()
                        .read_all()
                    )
                    if data.num_rows == 0:
                        raise ValueError("The CSV lists nothing")
                    mapping = cls()
                    setattr(mapping, table, data)
                    return mapping
            except duckdb.Error as error:
                raise ValueError(f"Not a readable CSV: {error}") from error
        finally:
            con.close()

        raise ValueError(
            "The CSV needs an ocel:oid or ocel:eid column, both for E2O "
            "relations, or ocel:oid_1 and ocel:oid_2 for O2O relations"
        )
