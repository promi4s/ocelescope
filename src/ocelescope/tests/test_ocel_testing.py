from __future__ import annotations

from datetime import datetime

import pytest
from ocel_testing import (
    build_log,
    e2o_pairs,
    event_ids,
    o2o_pairs,
    object_ids,
    snapshot,
)


def _rows(log, query):
    return log.sql(query).fetchall()


class TestEvents:
    def test_events_arrive_with_their_activity_and_attributes(self, make_log):
        log = make_log(
            events=[
                {"id": "e1", "type": "place", "attributes": {"channel": "web"}},
                {"id": "e2", "type": "pay", "attributes": {"amount": 10}},
            ]
        )
        assert _rows(
            log,
            'SELECT "ocel:eid", "ocel:activity", channel, amount '
            'FROM events ORDER BY "ocel:eid"',
        ) == [("e1", "place", "web", None), ("e2", "pay", None, 10)]

    def test_events_without_time_are_an_hour_apart(self, make_log):
        log = make_log(
            events=[
                {"id": "e1", "type": "place"},
                {"id": "e2", "type": "place"},
                {"id": "e3", "type": "place"},
            ]
        )
        assert _rows(
            log, 'SELECT "ocel:timestamp" FROM events ORDER BY "ocel:eid"'
        ) == [
            (datetime(2024, 1, 1, 0),),
            (datetime(2024, 1, 1, 1),),
            (datetime(2024, 1, 1, 2),),
        ]

    def test_time_with_an_offset_is_stored_as_utc(self, make_log):
        log = make_log(
            events=[{"id": "e1", "type": "pay", "time": "2024-03-01T00:00:00+01:00"}]
        )
        assert _rows(log, 'SELECT "ocel:timestamp" FROM events') == [
            (datetime(2024, 2, 29, 23),)
        ]


class TestObjects:
    def test_objects_arrive_with_their_type(self, make_log):
        log = make_log(
            objects=[{"id": "o1", "type": "order"}, {"id": "c1", "type": "customer"}]
        )
        assert _rows(
            log, 'SELECT "ocel:oid", "ocel:type" FROM objects ORDER BY "ocel:oid"'
        ) == [("c1", "customer"), ("o1", "order")]

    def test_untimed_attributes_are_static(self, make_log):
        log = make_log(
            objects=[
                {"id": "o1", "type": "order", "attributes": {"price": 10}},
                {"id": "o2", "type": "order", "attributes": {"price": 2.5}},
            ]
        )
        assert log.objects.static_attribute_names == ["price"]
        assert log.objects.pl.collect().sort("ocel:oid")["price"].to_list() == [
            10.0,
            2.5,
        ]

    def test_a_timed_value_makes_an_attribute_dynamic(self, make_log):
        log = make_log(
            objects=[
                {
                    "id": "o1",
                    "type": "order",
                    "attributes": [
                        {"name": "status", "value": "open"},
                        {"name": "status", "value": "paid", "time": "2024-02-01"},
                    ],
                }
            ]
        )
        assert log.objects.static_attribute_names == []
        assert _rows(
            log,
            'SELECT "ocel:timestamp", status FROM object_changes '
            'ORDER BY "ocel:timestamp"',
        ) == [(datetime(1970, 1, 1), "open"), (datetime(2024, 2, 1), "paid")]


class TestRelations:
    def test_e2o_arrives_with_its_qualifier(self, make_log):
        log = make_log(
            objects=[{"id": "o1", "type": "order"}, {"id": "c1", "type": "customer"}],
            events=[{"id": "e1", "type": "place"}],
            e2o=[
                {"source": "e1", "target": "c1", "qualifier": "customer"},
                {"source": "e1", "target": "o1"},
            ],
        )
        assert _rows(
            log,
            'SELECT "ocel:eid", "ocel:oid", "ocel:qualifier" FROM e2o '
            'ORDER BY "ocel:oid"',
        ) == [("e1", "c1", "customer"), ("e1", "o1", None)]

    def test_o2o_arrives_with_its_qualifier(self, make_log):
        log = make_log(
            objects=[{"id": "c1", "type": "customer"}, {"id": "o1", "type": "order"}],
            o2o=[{"source": "c1", "target": "o1", "qualifier": "places"}],
        )
        assert _rows(log, "FROM o2o") == [("c1", "o1", "places")]


class TestValidation:
    @pytest.mark.parametrize(
        "log",
        [
            {"objects": [{"id": "o1", "type": "a"}, {"id": "o1", "type": "b"}]},
            {"events": [{"id": "e1", "type": "a"}, {"id": "e1", "type": "b"}]},
        ],
        ids=["object", "event"],
    )
    def test_duplicate_ids_are_refused(self, log):
        with pytest.raises(ValueError, match="duplicate"):
            build_log(**log)

    @pytest.mark.parametrize(
        "log",
        [
            {
                "objects": [{"id": "o1", "type": "order"}],
                "e2o": [{"source": "e9", "target": "o1"}],
            },
            {
                "events": [{"id": "e1", "type": "place"}],
                "e2o": [{"source": "e1", "target": "o9"}],
            },
            {
                "objects": [{"id": "o1", "type": "order"}],
                "o2o": [{"source": "o9", "target": "o1"}],
            },
            {
                "objects": [{"id": "o1", "type": "order"}],
                "o2o": [{"source": "o1", "target": "o9"}],
            },
        ],
        ids=["e2o-event", "e2o-object", "o2o-source", "o2o-target"],
    )
    def test_relations_to_unknown_ids_are_refused(self, log):
        with pytest.raises(ValueError, match="unknown"):
            build_log(**log)


SMALL_LOG = {
    "objects": [
        {"id": "o1", "type": "order", "attributes": {"price": 10}},
        {"id": "i1", "type": "item"},
    ],
    "events": [{"id": "e1", "type": "place", "attributes": {"channel": "web"}}],
    "e2o": [{"source": "e1", "target": "o1"}],
    "o2o": [{"source": "o1", "target": "i1"}],
}


class TestOnDisk:
    def test_file_log_holds_the_same_tables(self, make_log):
        assert snapshot(make_log(**SMALL_LOG, on_disk=True)) == snapshot(
            make_log(**SMALL_LOG)
        )

    def test_file_log_is_read_only(self, make_log):
        log = make_log(**SMALL_LOG, on_disk=True)
        assert _rows(
            log,
            "SELECT readonly, path IS NOT NULL FROM duckdb_databases() "
            "WHERE database_name = current_database()",
        ) == [(True, True)]


def test_empty_log(make_log):
    log = make_log()
    assert event_ids(log) == set()
    assert object_ids(log) == set()
    assert e2o_pairs(log) == set()
    assert o2o_pairs(log) == set()
