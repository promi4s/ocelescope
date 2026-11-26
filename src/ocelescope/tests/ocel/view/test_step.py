from __future__ import annotations

import pyarrow as pa
import pytest
from ocel_testing import KeepIds, event_ids, object_ids, snapshot
from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, EID_COL
from ocelescope.ocel.constants.tables import E2O_TABLE, EVENTS_TABLE, OBJECTS_TABLE
from ocelescope.ocel.view import OCELView, Step, ViewOperation
from ocelescope.util.sql import ident, literal


def _ids(*ids: str) -> str:
    return " UNION ALL ".join(
        f"SELECT {literal(eid)} AS {ident(EID_COL)}" for eid in ids
    )


class SetTable(ViewOperation):
    def __init__(self, table: str, query: str):
        self.table = table
        self.query = query

    def build(self, step: Step) -> None:
        step[self.table] = self.query.format(events=step[EVENTS_TABLE])


class Keep(ViewOperation):
    def __init__(self, table: str):
        self.table = table

    def build(self, step: Step) -> None:
        step.keep(self.table, _ids("e1"))


class KeepMaterialized(ViewOperation):
    def __init__(self, eid: str):
        self.eid = eid

    def build(self, step: Step) -> None:
        kept = step.materialize("kept", _ids(self.eid))
        step.keep(EVENTS_TABLE, f"FROM {kept}")


class KeepMaterializedTwice(ViewOperation):
    def build(self, step: Step) -> None:
        first = step.materialize("kept", _ids("e1"))
        second = step.materialize("kept", _ids("e2"))
        step.keep(EVENTS_TABLE, f"FROM {first} UNION ALL FROM {second}")


class KeepLoaded(ViewOperation):
    def build(self, step: Step) -> None:
        kept = step.load("kept", pa.table({EID_COL: ["e3"]}))
        step.keep(EVENTS_TABLE, f"FROM {kept}")


@pytest.fixture
def log(make_log):
    return make_log(
        objects=[{"id": "o1", "type": "order"}, {"id": "o2", "type": "order"}],
        events=[
            {"id": "e1", "type": "place"},
            {"id": "e2", "type": "pay"},
            {"id": "e3", "type": "ship"},
        ],
        e2o=[
            {"source": "e1", "target": "o1"},
            {"source": "e2", "target": "o1"},
            {"source": "e3", "target": "o2"},
        ],
    )


class TestSettingTables:
    def test_setting_a_table_changes_the_view(self, log):
        with OCELView(log) as view:
            view.apply(
                SetTable(
                    EVENTS_TABLE,
                    f"SELECT * REPLACE (upper({ident(ACTIVITY_COL)}) "
                    f"AS {ident(ACTIVITY_COL)}) FROM {{events}}",
                )
            )
            activities = view.sql(
                f"SELECT {ident(ACTIVITY_COL)} FROM {EVENTS_TABLE}"
            ).fetchall()
            assert {a for (a,) in activities} == {"PLACE", "PAY", "SHIP"}

    def test_setting_a_table_leaves_the_log_untouched(self, log):
        before = snapshot(log)
        with OCELView(log) as view:
            view.apply(SetTable(EVENTS_TABLE, "FROM {events} LIMIT 0"))
            assert event_ids(view) == set()
        assert snapshot(log) == before

    def test_setting_an_unknown_table_is_refused(self, log):
        with OCELView(log) as view, pytest.raises(KeyError):
            view.apply(SetTable("nothing", "FROM {events}"))


class TestKeep:
    def test_keep_narrows_events_to_the_given_ids(self, log):
        with OCELView(log) as view:
            view.apply(KeepIds(EVENTS_TABLE, {"e1", "e3"}))
            assert event_ids(view) == {"e1", "e3"}

    def test_keep_narrows_objects_to_the_given_ids(self, log):
        with OCELView(log) as view:
            view.apply(KeepIds(OBJECTS_TABLE, {"o2"}))
            assert object_ids(view) == {"o2"}

    def test_keep_cannot_restore_an_id_an_earlier_step_dropped(self, log):
        with OCELView(log) as view:
            view.apply(KeepIds(EVENTS_TABLE, {"e1", "e2"}))
            assert event_ids(view) == {"e1", "e2"}

            view.apply(KeepIds(EVENTS_TABLE, {"e2", "e3"}))
            assert event_ids(view) == {"e2"}

    def test_keep_accepts_ids_the_log_does_not_have(self, log):
        with OCELView(log) as view:
            view.apply(KeepIds(EVENTS_TABLE, {"e1", "missing"}))
            assert event_ids(view) == {"e1"}

    def test_keep_with_no_ids_empties_the_table(self, log):
        with OCELView(log) as view:
            view.apply(KeepIds(EVENTS_TABLE, set()))
            assert event_ids(view) == set()

    def test_keep_is_refused_for_tables_other_than_events_and_objects(self, log):
        with OCELView(log) as view, pytest.raises(KeyError):
            view.apply(Keep(E2O_TABLE))


class TestStoredTables:
    def test_a_materialized_table_can_be_read(self, log):
        with OCELView(log) as view:
            view.apply(KeepMaterialized("e2"))
            assert event_ids(view) == {"e2"}

    def test_a_loaded_table_can_be_read(self, log):
        with OCELView(log) as view:
            view.apply(KeepLoaded())
            assert event_ids(view) == {"e3"}

    def test_one_step_can_store_the_same_name_twice(self, log):
        with OCELView(log) as view:
            view.apply(KeepMaterializedTwice())
            assert event_ids(view) == {"e1", "e2"}

    def test_steps_can_store_the_same_name(self, log):
        with OCELView(log) as view:
            view.apply(KeepMaterialized("e1"))
            assert event_ids(view) == {"e1"}

            view.apply(KeepMaterialized("e1"))
            assert event_ids(view) == {"e1"}
