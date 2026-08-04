from pathlib import Path
from typing import TYPE_CHECKING

import polars as pl
import r4pm

from ocelescope.ocel.constants.misc import EPOCH_SQL
from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    E2O_QUALIFIER,
    EID_COL,
    OBJECT_CHANGED_FIELD,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.ocel.constants.tables import (
    E2O_TABLE,
    EVENTS_TABLE,
    OBJECT_CHANGES_TABLE,
    OBJECTS_TABLE,
)
from ocelescope.util.sql import ident, literal

if TYPE_CHECKING:
    from ocelescope.ocel.core.ocel import OCEL


RENAME_MAP = {
    "case:concept:name": OID_COL,
    "concept:name": ACTIVITY_COL,
    "time:timestamp": TIMESTAMP_COL,
    f"case:{OTYPE_COL}": OTYPE_COL,
}

#: The same names the other way round, which is what the exporter writes.
XES_NAMES = {column: name for name, column in RENAME_MAP.items()}

#: What a dynamic object attribute is written under. It changes per event, so it
#: cannot take the ``case:`` prefix a static one does, and its bare name would
#: collide with an event attribute called the same.
DYNAMIC_PREFIX = "object:"


def create_ocel_from_xml(path: str, fallback_object_name: str = "LogObject") -> "OCEL":
    from ocelescope.ocel.core.ocel import OCEL

    log, _meta = r4pm.df.import_xes(path)

    log = log.rename({**RENAME_MAP}, strict=False)

    global_cols = [col.removeprefix("case:") for col in log.columns if col.startswith("case:")]

    event_cols = [
        col
        for col in log.columns
        if not col.startswith("case:")
        and col not in (EID_COL, OID_COL, ACTIVITY_COL, TIMESTAMP_COL, OTYPE_COL)
    ]

    log = log.with_columns(
        pl.col(col).cast(pl.String) for col in (OID_COL, EID_COL) if col in log.columns
    )

    if OTYPE_COL not in log.columns:
        log = log.with_columns(pl.lit(fallback_object_name).alias(OTYPE_COL))
    elif fallback_object_name is not None:
        log = log.with_columns(pl.col(OTYPE_COL).fill_null(fallback_object_name))

    if EID_COL not in log.columns:
        log = log.with_row_index(EID_COL).with_columns(
            (
                pl.col(ACTIVITY_COL)
                .str.to_lowercase()
                .str.strip_chars()
                .str.replace_all(r"[-\s]+", "_")
                + pl.lit("_")
                + pl.col(EID_COL).cast(pl.String)
            ).alias(EID_COL)
        )

    object_table = (
        log.select([f"case:{col}" for col in global_cols] + [OTYPE_COL, OID_COL])
        .unique(subset=[OID_COL])
        .rename({f"case:{col}": col for col in global_cols})
    )

    event_table = log.select(event_cols + [EID_COL, ACTIVITY_COL, TIMESTAMP_COL]).unique(
        subset=[EID_COL]
    )

    e2o_table = log.select([EID_COL, OTYPE_COL, ACTIVITY_COL, OID_COL, TIMESTAMP_COL]).with_columns(
        pl.lit(None, dtype=pl.String).alias(E2O_QUALIFIER)
    )

    return OCEL.from_frames(
        events=event_table,
        objects=object_table,
        relations=e2o_table,
    )


def write_ocel_to_xes(ocel: "OCEL", object_type: str, path: str | Path) -> None:
    """Write the log flattened on ``object_type`` to an XES file.

    Args:
        ocel: The log to flatten.
        object_type: The object type whose objects become the cases.
        path: Where to write the file.
    """
    oid, otype, ts = ident(OID_COL), ident(OTYPE_COL), ident(TIMESTAMP_COL)
    eid, activity, field = ident(EID_COL), ident(ACTIVITY_COL), ident(OBJECT_CHANGED_FIELD)

    kinds = ocel.sql(
        f"SELECT {field}, max({ts}) = {EPOCH_SQL} AS is_static "
        f"FROM {OBJECT_CHANGES_TABLE} "
        f"WHERE {oid} IN (SELECT {oid} FROM {OBJECTS_TABLE} WHERE {otype} = ?) "
        f"GROUP BY {field} ORDER BY {field}",
        [object_type],
    ).fetchall()
    static = [name for name, is_static in kinds if is_static]
    dynamic = [name for name, is_static in kinds if not is_static]

    static_cte, static_join = "", ""
    if static:
        values = ", ".join(
            f"any_value({ident(name)}) AS {ident(f'case:{name}')}" for name in static
        )
        static_cte = (
            f"static_values AS ("
            f"SELECT {oid}, {values} FROM {OBJECT_CHANGES_TABLE} "
            f"JOIN object_ids USING ({oid}) GROUP BY {oid}), "
        )
        static_join = f"LEFT JOIN static_values USING ({oid})"

    columns = [
        f"f.{eid}",
        f"f.{ident(E2O_QUALIFIER)}",
        f"f.{oid} AS {ident(XES_NAMES[OID_COL])}",
        f"{literal(object_type)} AS {ident(XES_NAMES[OTYPE_COL])}",
        f"f.{activity} AS {ident(XES_NAMES[ACTIVITY_COL])}",
        f"f.{ts} AS {ident(XES_NAMES[TIMESTAMP_COL])}",
        *(f"f.{ident(name)}" for name in ocel.events.attribute_names),
        *(f"f.{ident(f'case:{name}')}" for name in static),
        *(f"s.{ident(name)} AS {ident(f'{DYNAMIC_PREFIX}{name}')}" for name in dynamic),
    ]

    flattened = ocel.objects.attribute_states(object_types=[object_type], attributes=dynamic).query(
        "attribute_states",
        f"WITH object_ids AS "
        f"(SELECT {oid} FROM {OBJECTS_TABLE} WHERE {otype} = {literal(object_type)}), "
        f"{static_cte}"
        f"flattened AS (SELECT * FROM {E2O_TABLE} JOIN object_ids USING ({oid}) "
        f"LEFT JOIN {EVENTS_TABLE} USING ({eid}) {static_join}) "
        f"SELECT {', '.join(columns)} FROM flattened f "
        f"ASOF LEFT JOIN attribute_states s "
        f"ON f.{oid} = s.{oid} AND f.{ts} >= s.{ts} "
        f"ORDER BY f.{oid}, f.{ts}",
    )

    r4pm.df.export_xes(flattened.pl().with_columns(pl.col(pl.String) + ""), str(path))
