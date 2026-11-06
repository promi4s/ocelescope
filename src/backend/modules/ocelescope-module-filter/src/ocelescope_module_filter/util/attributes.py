from __future__ import annotations

from typing import Literal

from ocelescope.ocel.constants.tables import EVENTS_TABLE, OBJECT_CHANGES_TABLE
from ocelescope.util.sql import ident
from ocelescope_module_ocel.util.attributes import (
    ENTITY_TYPE,
    EntityType,
    long_table,
)
from pydantic import BaseModel

from ocelescope import OCEL

ValueType = Literal["string", "bool", "int", "float", "date"]

_VALUE_TYPES: dict[str, ValueType] = {
    "BIGINT": "int",
    "DOUBLE": "float",
    "BOOLEAN": "bool",
    "DATE": "date",
}


class SharedAttribute(BaseModel):
    name: str
    type: ValueType
    entity_types: list[str]


def shared_attributes(
    ocel: OCEL,
    entity_type: EntityType,
    entity_names: list[str] | None = None,
) -> list[SharedAttribute]:
    table = EVENTS_TABLE if entity_type == "events" else OBJECT_CHANGES_TABLE
    columns = {
        name: dtype.upper()
        for name, dtype, *_ in ocel.con.execute(f"DESCRIBE {ident(table)}").fetchall()
    }
    rows = (
        long_table(ocel, entity_type, entity_names=entity_names)
        .query(
            "long",
            f"SELECT name, list(DISTINCT {ident(ENTITY_TYPE)} "
            f"ORDER BY {ident(ENTITY_TYPE)}) "
            "FROM long GROUP BY name ORDER BY name",
        )
        .fetchall()
    )
    return [
        SharedAttribute(
            name=name,
            type="date"
            if columns[name].startswith("TIMESTAMP")
            else _VALUE_TYPES.get(columns[name], "string"),
            entity_types=entities,
        )
        for name, entities in rows
    ]
