import hashlib
import json
import tempfile
import zipfile
from pathlib import Path
from typing import Any, ClassVar, Literal, Self

import duckdb
from duckdb import (
    CatalogException,
    DuckDBPyConnection,
    DuckDBPyRelation,
    InvalidInputException,
)
from duckdb.sqltypes import DuckDBPyType

from ocelescope.resource.base import ResourceBase
from ocelescope.util.sql import ident, literal

COLUMN_TYPE = Literal[
    "int",
    "float",
    "str",
    "timestamp",
]

COLUMN_TYPES_TO_MAP: dict[COLUMN_TYPE, DuckDBPyType] = {
    "int": DuckDBPyType(int),
    "float": DuckDBPyType(float),
    "str": DuckDBPyType(str),
    "timestamp": DuckDBPyType("TIMESTAMP"),
}

MANIFEST_FILE = "manifest.json"
SET_VIEW = "_ocelescope_set"


class TabularResourceError(Exception):
    pass


class TableNotFoundException(TabularResourceError):
    def __init__(self, table_name: str):
        super().__init__(f"Table {table_name} not found")


class InvalidSchemaException(TabularResourceError):
    def __init__(
        self,
        table_name: str,
        table_ddl: set[tuple[str, DuckDBPyType]],
        schema_ddl: set[tuple[str, DuckDBPyType]],
    ):
        super().__init__(
            f"Table {table_name} has a incompatible schema ({table_ddl}) of the given Table definition ({schema_ddl})"
        )


class Table:
    def __init__(
        self,
        schema: list[tuple[str, COLUMN_TYPE]],
        extra_columns: Literal["ignore", "raise"] = "ignore",
    ):
        self.schema = schema
        self.extra_columns = extra_columns

    def __set_name__(self, owner, name):
        self.table_name = name

    @property
    def ddl(self) -> str:
        columns = ", ".join(
            f"{ident(col_name)} {COLUMN_TYPES_TO_MAP[col_type]}"
            for (col_name, col_type) in self.schema
        )

        return f"CREATE TABLE {ident(self.table_name)} ({columns})"

    def validate(self, con: DuckDBPyConnection):
        schema = {
            (col_name, COLUMN_TYPES_TO_MAP[col_type])
            for (col_name, col_type) in self.schema
        }

        try:
            table_desc = {
                (col_descr[0], col_descr[1])
                for col_descr in con.table(self.table_name).description
            }
        except CatalogException:
            raise TableNotFoundException(self.table_name)

        is_valid = (
            schema == table_desc
            if self.extra_columns == "raise"
            else schema <= table_desc
        )
        if not is_valid:
            raise InvalidSchemaException(
                table_name=self.table_name, table_ddl=table_desc, schema_ddl=schema
            )

    def __get__(self, obj: "TabularResource | None", objtype=None):
        if obj is None:
            return self
        return obj.con.table(self.table_name)

    def __set__(self, obj: "TabularResource", value: Any):
        """Replace the table's contents with ``value``.

        ``value`` can be anything DuckDB can scan: a pandas or polars DataFrame,
        an Arrow table or a ``DuckDBPyRelation``. Its schema columns are cast to
        the declared types; any other columns are dropped.
        """
        try:
            obj.con.register(SET_VIEW, value)
        except InvalidInputException:
            if not isinstance(value, DuckDBPyRelation):
                raise
            obj.con.register(SET_VIEW, value.arrow())

        columns = ", ".join(
            f"CAST({ident(col_name)} AS {COLUMN_TYPES_TO_MAP[col_type]}) AS {ident(col_name)}"
            for (col_name, col_type) in self.schema
        )
        try:
            obj.con.sql(
                f"CREATE OR REPLACE TABLE {ident(self.table_name)} AS SELECT {columns} FROM {SET_VIEW}"
            )
        finally:
            obj.con.unregister(SET_VIEW)


class TabularResource(ResourceBase):
    """A resource whose data lives in DuckDB tables declared as ``Table`` attributes.

    Internal storage is a single ``.duckdb`` file opened lazily via :meth:`open`;
    the exchange format is a zip of Parquet files (one per table) plus a
    ``manifest.json``, written by :meth:`write` and read by :meth:`read`.
    """

    tables: ClassVar[dict[str, Table]] = {}

    def __init_subclass__(cls, **kwargs) -> None:
        super().__init_subclass__(**kwargs)
        cls.tables = {
            name: attr
            for klass in reversed(cls.__mro__)
            for name, attr in vars(klass).items()
            if isinstance(attr, Table)
        }

    def __init__(self, con: DuckDBPyConnection | None = None):
        self._con = con or duckdb.connect(":memory:")
        self._meta = {}

        for table in self.tables.values():
            try:
                table.validate(self._con)
            except TableNotFoundException:
                self._con.sql(table.ddl)

    @property
    def con(self) -> DuckDBPyConnection:
        return self._con

    @classmethod
    def get_schema_hash(cls) -> str:
        schema = {name: table.schema for name, table in sorted(cls.tables.items())}
        return hashlib.sha256(json.dumps(schema).encode()).hexdigest()

    @classmethod
    def open(cls, path: str | Path, read_only: bool = True) -> Self:
        """Open a ``.duckdb`` file without loading it into memory."""
        return cls(duckdb.connect(str(path), read_only=read_only))

    def save(self, path: str | Path) -> Path:
        """Persist all tables into a new ``.duckdb`` file."""
        path = Path(path)
        self.con.sql(f"ATTACH {literal(str(path))} AS _save")
        try:
            for name in self.tables:
                self.con.sql(f"CREATE TABLE _save.{ident(name)} AS FROM {ident(name)}")
        finally:
            self.con.sql("DETACH _save")
        return path

    def write(self, path: str | Path) -> Path:
        """Write the exchange format: a single zip file with ``manifest.json`` + ``<table>.parquet``."""
        path = Path(path)
        if path.suffix != ".ocelescope":
            path = path.with_name(path.name + ".ocelescope")

        with tempfile.TemporaryDirectory() as tmp, zipfile.ZipFile(path, "w") as zf:
            for name in self.tables:
                file = Path(tmp) / f"{name}.parquet"
                self.con.sql(
                    f"COPY {ident(name)} TO {literal(str(file))} (FORMAT parquet)"
                )
                zf.write(file, file.name)

            zf.writestr(
                MANIFEST_FILE,
                json.dumps(
                    {
                        "resource": type(self).__name__,
                        "schema_hash": self.get_schema_hash(),
                        "tables": list(self.tables),
                        "extra": self.meta,
                    }
                ),
            )
        return path

    @classmethod
    def read(cls, path: str | Path, con: DuckDBPyConnection | None = None) -> Self:
        """Read the exchange format into ``con`` (in-memory by default)."""
        path = Path(path)
        con = con or duckdb.connect(":memory:")

        with tempfile.TemporaryDirectory() as tmp, zipfile.ZipFile(path) as zf:
            manifest = json.loads(zf.read(MANIFEST_FILE))
            if manifest["schema_hash"] != cls.get_schema_hash():
                raise ValueError(
                    f"{path.name} was written by a different version of {cls.__name__}"
                )

            for name in cls.tables:
                file = Path(zf.extract(f"{name}.parquet", tmp))
                con.sql(
                    f"CREATE TABLE {ident(name)} AS FROM read_parquet({literal(str(file))})"
                )
        return cls(con).with_meta(**manifest.get("extra", {}))

    def close(self):
        return self._con.close()

    def __enter__(self):
        return self

    def __exit__(self, exec_type, exc, tb):
        self.close()
