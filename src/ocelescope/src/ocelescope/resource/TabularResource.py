from abc import ABC
from typing import Literal

import duckdb
from duckdb import CatalogException, DuckDBPyConnection, connect
from duckdb.sqltypes import DuckDBPyType

COLUMN_TYPE = Literal[
    "int",
    "float",
    "str",
]

COLUMN_TYPES_TO_MAP: dict[COLUMN_TYPE, DuckDBPyType] = {
    "int": DuckDBPyType(int),
    "float": DuckDBPyType(float),
    "str": DuckDBPyType(str),
}


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


class TabularResource(ABC):
    def __init_subclass__(cls) -> None:
        cls.tables = {
            name: attr for name, attr in vars(cls).items() if isinstance(attr, Table)
        }

    def __init__(self, con: DuckDBPyConnection | None = None):
        self._con = con or duckdb.connect(":memory:")

        for table in self.tables.values():
            try:
                table.validate(self._con)
            except TableNotFoundException:
                self._con.sql(table.ddl)

    @property
    def con(self) -> DuckDBPyConnection:
        return self._con

    def close(self):
        return self._con.close()

    def __enter__(self):
        return self

    def __exit__(self, exec_type, exc, tb):
        self.close()


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
    def ddl(self):
        columns = ",".join(
            [
                col_name + " " + str(COLUMN_TYPES_TO_MAP[col_type])
                for (col_name, col_type) in self.schema
            ]
        )

        return f"CREATE TABLE {self.table_name} ({columns})"

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

        if not schema <= table_desc:
            raise InvalidSchemaException(
                table_name=self.table_name, table_ddl=table_desc, schema_ddl=schema
            )

        return

    def __get__(self, obj: TabularResource, objtype=None):
        return obj.con.table(self.table_name)


class Test(TabularResource):
    test = Table(schema=[("ad", "float")])


with connect("notebooks/test.db") as con:
    Test(con)
