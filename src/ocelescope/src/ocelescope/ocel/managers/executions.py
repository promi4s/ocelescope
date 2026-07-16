from __future__ import annotations

from typing import Iterable, cast

import pandas as pd

from ocelescope.ocel.constants.executions import (
    EXECUTION_ACT_LIST_COL,
    EXECUTION_EID_LIST_COL,
    EXECUTION_OTYPE_COL,
    EXECUTION_TSTAMP_LIST_COL,
    EXECUTION_VARIANT_ID_COL,
    VARIANT_ACT_LIST_COL,
    VARIANT_FREQUENCY_COL,
    VARIANT_OTYPE_COL,
)
from ocelescope.ocel.constants.pm4py import (
    ACTIVITY_COL,
    EID_COL,
    OID_COL,
    OTYPE_COL,
    TIMESTAMP_COL,
)
from ocelescope.ocel.managers.base import BaseManager
from ocelescope.ocel.util.hash import hash_string_list

#: Orders an object's events into its execution sequence.
#:
#: Events sharing a timestamp have no inherent order, yet the order decides the
#: activity sequence and so the variant. Breaking the tie by ``ocel:activity``
#: makes that choice canonical: an execution depends only on *which* activities
#: happened *when*, so two objects with the same timed activities always land in
#: the same variant -- never split apart by an incidental detail like the order
#: their rows are stored in. ``ocel:eid`` then breaks the remaining tie (one
#: object, one instant, the same activity twice), which cannot move an activity
#: but does pin ``eid_list``.
_EVENT_ORDER = f'e."{TIMESTAMP_COL}", e."{ACTIVITY_COL}", e."{EID_COL}"'

#: An object joined to each of its events, the shape every execution is built from.
_FROM_OBJECT_EVENTS = (
    f"FROM objects o "
    f'JOIN e2o r ON o."{OID_COL}" = r."{OID_COL}" '
    f'JOIN events e ON r."{EID_COL}" = e."{EID_COL}"'
)


class ExecutionsManager(BaseManager):
    """
    Manages object executions and their variants.

    An object's *execution* is the sequence of activities it takes part in, in
    time order; a *variant* is a distinct such sequence, and every object
    following it is one of its cases.

    A variant is identified by ``<object type>_<hash of the activity sequence>``,
    so the id depends only on the sequence itself -- the same execution keeps its
    id across logs, and across filtered views of one log. Two objects share a
    variant exactly when the same activities happened at the same times; see
    :data:`_EVENT_ORDER` for how events sharing a timestamp are ordered.

    The grouping runs in DuckDB, so an object's events are collapsed into its
    sequence without any of them being read into Python.
    """

    def _type_filter(self, object_types: Iterable[str] | None, params: list[object]) -> str:
        """WHERE clause restricting to ``object_types``; None = all, empty = nothing."""
        if object_types is None:
            return ""
        wanted = list(object_types)
        if not wanted:
            return "WHERE false"
        params.extend(wanted)
        return f'WHERE o."{OTYPE_COL}" IN ({", ".join(["?"] * len(wanted))})'

    def _variant_ids(self, otypes: pd.Series, sequences: pd.Series) -> pd.Series:
        """The variant id of each ``(object type, activity sequence)`` pair."""
        return otypes + "_" + sequences.apply(hash_string_list)

    def get_object_executions(
        self,
        object_types: list[str] | None = None,
        include_timestamps: bool = False,
        include_eid: bool = False,
    ) -> pd.DataFrame:
        """
        Return one execution per object: its activity sequence and variant id.

        Objects taking part in no event have no execution and are left out.

        Args:
            object_types: Optional object types to include (None = all).
            include_timestamps: Also return each execution's event timestamps.
            include_eid: Also return each execution's event ids.

        Returns:
            pandas.DataFrame: Indexed by `ocel:oid`, with the object type, the
            activity sequence, the requested optional sequences, and `variant_id`.
        """
        params: list[object] = []
        where = self._type_filter(object_types, params)

        sequences = [f'list(e."{ACTIVITY_COL}" ORDER BY {_EVENT_ORDER}) AS "{EXECUTION_ACT_LIST_COL}"']
        if include_timestamps:
            sequences.append(
                f'list(e."{TIMESTAMP_COL}" ORDER BY {_EVENT_ORDER}) AS "{EXECUTION_TSTAMP_LIST_COL}"'
            )
        if include_eid:
            sequences.append(
                f'list(e."{EID_COL}" ORDER BY {_EVENT_ORDER}) AS "{EXECUTION_EID_LIST_COL}"'
            )

        query = (
            f'SELECT o."{OID_COL}", o."{OTYPE_COL}" AS "{EXECUTION_OTYPE_COL}", '
            f"{', '.join(sequences)} "
            f"{_FROM_OBJECT_EVENTS} {where} "
            f'GROUP BY o."{OID_COL}", o."{OTYPE_COL}" ORDER BY o."{OID_COL}"'
        )
        executions = self._relation(query, params).df().set_index(OID_COL)

        # DuckDB hands a LIST column back as a numpy array, so the sequences are
        # unpacked into plain lists.
        for column in (EXECUTION_ACT_LIST_COL, EXECUTION_EID_LIST_COL):
            if column in executions.columns:
                executions[column] = executions[column].apply(list)
        if EXECUTION_TSTAMP_LIST_COL in executions.columns:
            # A LIST loses its element type's time zone on the way out, leaving a
            # naive datetime64 of the UTC reading. Restoring UTC keeps these
            # timestamps comparable to every other one the OCEL hands out.
            executions[EXECUTION_TSTAMP_LIST_COL] = executions[EXECUTION_TSTAMP_LIST_COL].apply(
                lambda times: [pd.Timestamp(time, tz="UTC") for time in times]
            )

        executions[EXECUTION_VARIANT_ID_COL] = self._variant_ids(
            cast(pd.Series, executions[EXECUTION_OTYPE_COL]),
            cast(pd.Series, executions[EXECUTION_ACT_LIST_COL]),
        )
        return executions

    def get_object_variants(self, object_types: list[str] | None = None) -> pd.DataFrame:
        """
        Return the distinct executions, with how many objects follow each.

        Identical sequences are grouped by DuckDB, so this reads one row per
        variant rather than one per object.

        Args:
            object_types: Optional object types to include (None = all).

        Returns:
            pandas.DataFrame: Indexed by `variant_id`, with the object type, the
            activity sequence and the number of objects following it.
        """
        params: list[object] = []
        where = self._type_filter(object_types, params)

        query = (
            f"WITH executions AS ("
            f'SELECT o."{OTYPE_COL}" AS "{VARIANT_OTYPE_COL}", '
            f'list(e."{ACTIVITY_COL}" ORDER BY {_EVENT_ORDER}) AS "{VARIANT_ACT_LIST_COL}" '
            f"{_FROM_OBJECT_EVENTS} {where} "
            f'GROUP BY o."{OID_COL}", o."{OTYPE_COL}") '
            f'SELECT "{VARIANT_OTYPE_COL}", "{VARIANT_ACT_LIST_COL}", '
            f'count(*) AS "{VARIANT_FREQUENCY_COL}" '
            f'FROM executions GROUP BY "{VARIANT_OTYPE_COL}", "{VARIANT_ACT_LIST_COL}" '
            f'ORDER BY "{VARIANT_OTYPE_COL}" DESC, "{VARIANT_FREQUENCY_COL}" DESC, '
            f'"{VARIANT_ACT_LIST_COL}"'
        )
        variants = self._relation(query, params).df()
        variants[VARIANT_ACT_LIST_COL] = variants[VARIANT_ACT_LIST_COL].apply(list)
        variants[EXECUTION_VARIANT_ID_COL] = self._variant_ids(
            cast(pd.Series, variants[VARIANT_OTYPE_COL]),
            cast(pd.Series, variants[VARIANT_ACT_LIST_COL]),
        )
        return cast(
            pd.DataFrame,
            variants.set_index(EXECUTION_VARIANT_ID_COL)[
                [VARIANT_OTYPE_COL, VARIANT_ACT_LIST_COL, VARIANT_FREQUENCY_COL]
            ],
        )

    def get_variant_object_ids(self, object_type: str, variant_ids: list[str]) -> list[str]:
        """Return the ids of the objects of ``object_type`` that follow any of ``variant_ids``."""
        params: list[object] = []
        where = self._type_filter([object_type], params)

        # Group first, so only one row per variant is read and only one hash is
        # computed per distinct sequence rather than one per object.
        query = (
            f"WITH executions AS ("
            f'SELECT o."{OID_COL}" AS oid, o."{OTYPE_COL}" AS otype, '
            f'list(e."{ACTIVITY_COL}" ORDER BY {_EVENT_ORDER}) AS act_list '
            f"{_FROM_OBJECT_EVENTS} {where} "
            f'GROUP BY o."{OID_COL}", o."{OTYPE_COL}") '
            f"SELECT otype, act_list, list(oid) AS ids "
            f"FROM executions GROUP BY otype, act_list"
        )
        wanted = set(variant_ids)
        matched: list[str] = []
        for otype, act_list, ids in self._relation(query, params).fetchall():
            if f"{otype}_{hash_string_list(act_list)}" in wanted:
                matched.extend(ids)
        return sorted(matched)
