from __future__ import annotations

from ocelescope.util.sql import ident
from ocelescope_module_ocel.models.attributes import ValueType
from ocelescope_module_ocel.util.attributes import (
    ENTITY_TYPE,
    EntityType,
    attribute_types,
    long_table,
)
from pydantic import BaseModel

from ocelescope import OCEL


class SharedAttribute(BaseModel):
    name: str
    type: ValueType
    entity_types: list[str]


def shared_attributes(
    ocel: OCEL,
    entity_type: EntityType,
    entity_names: list[str] | None = None,
) -> list[SharedAttribute]:
    types = attribute_types(ocel, entity_type)
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
        SharedAttribute(name=name, type=types[name], entity_types=entities)
        for name, entities in rows
    ]
