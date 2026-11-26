from __future__ import annotations

from ocel_testing import (
    KeepIds,
    changed_object_ids,
    e2o_pairs,
    event_ids,
    o2o_pairs,
    object_ids,
    snapshot,
)
from ocelescope.ocel.constants.tables import EVENTS_TABLE, OBJECTS_TABLE
from ocelescope.ocel.view import Clean, OCELView


class TestCleanLog:
    def test_clean_log_is_unchanged(self, make_log):
        log = make_log(
            objects=[{"id": "o1", "type": "order"}, {"id": "i1", "type": "item"}],
            events=[{"id": "e1", "type": "place"}],
            e2o=[{"source": "e1", "target": "o1"}],
            o2o=[{"source": "o1", "target": "i1"}],
        )
        with OCELView(log) as view:
            view.apply(Clean())
            assert snapshot(view) == snapshot(log)


class TestDanglingRelations:
    def test_e2o_to_a_dropped_event_is_removed(self, make_log):
        log = make_log(
            objects=[{"id": "o1", "type": "order"}],
            events=[{"id": "e1", "type": "place"}, {"id": "e2", "type": "place"}],
            e2o=[{"source": "e1", "target": "o1"}, {"source": "e2", "target": "o1"}],
        )
        with OCELView(log) as view:
            view.apply(KeepIds(EVENTS_TABLE, {"e1"}))
            assert ("e2", "o1") in e2o_pairs(view)

            view.apply(Clean())
            assert e2o_pairs(view) == {("e1", "o1")}

    def test_e2o_to_a_dropped_object_is_removed(self, make_log):
        log = make_log(
            objects=[{"id": "o1", "type": "order"}, {"id": "o2", "type": "order"}],
            events=[{"id": "e1", "type": "place"}],
            e2o=[{"source": "e1", "target": "o1"}, {"source": "e1", "target": "o2"}],
        )
        with OCELView(log) as view:
            view.apply(KeepIds(OBJECTS_TABLE, {"o1"}))
            assert ("e1", "o2") in e2o_pairs(view)

            view.apply(Clean())
            assert e2o_pairs(view) == {("e1", "o1")}

    def test_o2o_to_a_dropped_object_is_removed(self, make_log):
        log = make_log(
            objects=[{"id": "o1", "type": "order"}, {"id": "i1", "type": "item"}],
            events=[{"id": "e1", "type": "place"}],
            e2o=[{"source": "e1", "target": "o1"}, {"source": "e1", "target": "i1"}],
            o2o=[{"source": "o1", "target": "i1"}],
        )
        with OCELView(log) as view:
            view.apply(KeepIds(OBJECTS_TABLE, {"o1"}))
            assert o2o_pairs(view) == {("o1", "i1")}

            view.apply(Clean())
            assert o2o_pairs(view) == set()


class TestUnrelatedEntities:
    def test_object_in_no_relation_is_dropped(self, make_log):
        log = make_log(
            objects=[{"id": "o1", "type": "order"}, {"id": "o2", "type": "order"}],
            events=[{"id": "e1", "type": "place"}],
            e2o=[{"source": "e1", "target": "o1"}],
        )
        with OCELView(log) as view:
            view.apply(Clean())
            assert object_ids(view) == {"o1"}

    def test_object_only_in_o2o_is_kept(self, make_log):
        log = make_log(
            objects=[
                {"id": "o1", "type": "order"},
                {"id": "i1", "type": "item"},
                {"id": "i2", "type": "item"},
            ],
            events=[{"id": "e1", "type": "place"}],
            e2o=[{"source": "e1", "target": "o1"}],
            o2o=[{"source": "i1", "target": "i2"}],
        )
        with OCELView(log) as view:
            view.apply(Clean())
            assert object_ids(view) == {"o1", "i1", "i2"}
            assert o2o_pairs(view) == {("i1", "i2")}

    def test_event_without_e2o_is_dropped(self, make_log):
        log = make_log(
            objects=[{"id": "o1", "type": "order"}],
            events=[{"id": "e1", "type": "place"}, {"id": "e2", "type": "place"}],
            e2o=[{"source": "e1", "target": "o1"}],
        )
        with OCELView(log) as view:
            view.apply(Clean())
            assert event_ids(view) == {"e1"}


class TestCascades:
    def test_object_whose_events_were_all_dropped_is_dropped(self, make_log):
        log = make_log(
            objects=[{"id": "o1", "type": "order"}, {"id": "o2", "type": "order"}],
            events=[{"id": "e1", "type": "place"}, {"id": "e2", "type": "place"}],
            e2o=[{"source": "e1", "target": "o1"}, {"source": "e2", "target": "o2"}],
        )
        with OCELView(log) as view:
            view.apply(KeepIds(EVENTS_TABLE, {"e1"}))
            assert object_ids(view) == {"o1", "o2"}

            view.apply(Clean())
            assert object_ids(view) == {"o1"}

    def test_event_whose_objects_were_all_dropped_is_dropped(self, make_log):
        log = make_log(
            objects=[{"id": "o1", "type": "order"}, {"id": "o2", "type": "order"}],
            events=[{"id": "e1", "type": "place"}, {"id": "e2", "type": "place"}],
            e2o=[{"source": "e1", "target": "o1"}, {"source": "e2", "target": "o2"}],
        )
        with OCELView(log) as view:
            view.apply(KeepIds(OBJECTS_TABLE, {"o1"}))
            assert event_ids(view) == {"e1", "e2"}

            view.apply(Clean())
            assert event_ids(view) == {"e1"}


class TestObjectChanges:
    def test_changes_of_a_dropped_object_are_removed(self, make_log):
        log = make_log(
            objects=[
                {"id": "o1", "type": "order", "attributes": {"price": 10}},
                {
                    "id": "o2",
                    "type": "order",
                    "attributes": [
                        {"name": "status", "value": "open"},
                        {"name": "status", "value": "paid", "time": "2024-02-01"},
                    ],
                },
            ],
            events=[{"id": "e1", "type": "place"}, {"id": "e2", "type": "place"}],
            e2o=[{"source": "e1", "target": "o1"}, {"source": "e2", "target": "o2"}],
        )
        with OCELView(log) as view:
            view.apply(KeepIds(EVENTS_TABLE, {"e1"}))
            assert changed_object_ids(view) == {"o1", "o2"}

            view.apply(Clean())
            assert changed_object_ids(view) == {"o1"}
