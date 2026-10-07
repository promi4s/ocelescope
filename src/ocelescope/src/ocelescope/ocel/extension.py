from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ocelescope.ocel.core import OCEL


class OCELExtensionError(ValueError):
    """A log is not a valid log of an OCEL extension."""


@dataclass(frozen=True)
class Extension:
    """What a format adds to OCEL: a named collection of tables.

    A subclass of :class:`~ocelescope.OCEL` carries one as its ``extension``::

        class QEL(OCEL):
            extension = Extension(
                name="qel",
                label="QEL",
                tables={"quantities": [("ocel:oid", "VARCHAR"), ...]},
            )

    Attributes:
        name: Stable key of the format, e.g. ``"qel"``.
        label: Human-readable name, e.g. ``"QEL"``.
        tables: The tables the format adds, each with its columns as
            ``(name, DuckDB type)``.
        optional: Names of tables a log of this format may lack. OCEL files do not
            store empty tables, so a table that can be empty should be listed here.
    """

    name: str
    label: str
    tables: Mapping[str, Sequence[tuple[str, str]]]
    optional: Sequence[str] = ()

    def validate(self, ocel: OCEL) -> None:
        """Raise an :class:`OCELExtensionError` unless ``ocel`` has this format's tables.

        Every table not listed as optional has to be there with its declared
        columns; if all are optional, at least one. Only names are compared: a
        column's type does not survive every file format.
        """
        present: dict[str, set[str]] = {}
        for table, column in ocel.sql(
            "SELECT table_name, column_name FROM duckdb_columns() "
            "WHERE database_name = current_database() AND schema_name = current_schema()"
        ).fetchall():
            present.setdefault(table, set()).add(column)

        for table, columns in self.tables.items():
            if table not in present:
                if table not in self.optional:
                    raise OCELExtensionError(f"table {table!r} is missing")
                continue
            if missing := [name for name, _ in columns if name not in present[table]]:
                raise OCELExtensionError(
                    f"table {table!r} lacks the columns {', '.join(missing)}"
                )

        if not any(table in present for table in self.tables):
            raise OCELExtensionError(
                f"none of the tables {', '.join(self.tables)} is there"
            )
