from __future__ import annotations

import hashlib
from pathlib import Path

import duckdb
import pytest
from ocel_testing import KeepIds, event_ids, object_ids, snapshot
from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, EID_COL
from ocelescope.ocel.constants.tables import EVENTS_TABLE, OBJECTS_TABLE
from ocelescope.ocel.core import OCEL
from ocelescope.ocel.view import Clean, OCELView, Step, ViewOperation
from ocelescope.util.sql import ident, literal

ORDERS = {
    "objects": [
        {"id": "c1", "type": "customer", "attributes": {"name": "Ada"}},
        {
            "id": "o1",
            "type": "order",
            "attributes": [
                {"name": "status", "value": "open"},
                {"name": "status", "value": "paid", "time": "2024-02-01"},
            ],
        },
        {"id": "o2", "type": "order", "attributes": {"price": 99.5}},
    ],
    "events": [
        {"id": "e1", "type": "place", "attributes": {"channel": "web"}},
        {"id": "e2", "type": "place"},
        {"id": "e3", "type": "pay", "time": "2024-02-01"},
    ],
    "e2o": [
        {"source": "e1", "target": "c1", "qualifier": "customer"},
        {"source": "e1", "target": "o1"},
        {"source": "e2", "target": "c1", "qualifier": "customer"},
        {"source": "e2", "target": "o2"},
        {"source": "e3", "target": "o1"},
    ],
    "o2o": [
        {"source": "c1", "target": "o1", "qualifier": "places"},
        {"source": "c1", "target": "o2", "qualifier": "places"},
    ],
}


class UppercaseActivities(ViewOperation):
    def build(self, step: Step) -> None:
        activity = ident(ACTIVITY_COL)
        step[EVENTS_TABLE] = (
            f"SELECT * REPLACE (upper({activity}) AS {activity}) "
            f"FROM {step[EVENTS_TABLE]}"
        )


class KeepActivity(ViewOperation):
    def __init__(self, activity: str):
        self.activity = activity

    def build(self, step: Step) -> None:
        step.keep(
            EVENTS_TABLE,
            f"SELECT {ident(EID_COL)} FROM {step[EVENTS_TABLE]} "
            f"WHERE {ident(ACTIVITY_COL)} = {literal(self.activity)}",
        )


@pytest.fixture(params=[False, True], ids=["memory", "file"])
def log(request, make_log) -> OCEL:
    return make_log(**ORDERS, on_disk=request.param)


@pytest.fixture
def file_log(make_log) -> OCEL:
    return make_log(**ORDERS, on_disk=True)


@pytest.fixture
def memory_log(make_log) -> OCEL:
    return make_log(**ORDERS)


def _databases(log: OCEL) -> set[str]:
    return {
        name
        for (name,) in log.sql(
            "SELECT database_name FROM duckdb_databases()"
        ).fetchall()
    }


def _path(log: OCEL) -> Path:
    return Path(
        log.sql(
            "SELECT path FROM duckdb_databases() "
            "WHERE database_name = current_database()"
        ).fetchall()[0][0]
    )


def _file_hash(log: OCEL) -> str:
    return hashlib.sha256(_path(log).read_bytes()).hexdigest()


class TestIsolation:
    def test_without_operations_the_view_shows_the_log(self, log):
        with OCELView(log) as view:
            assert snapshot(view) == snapshot(log)

    def test_applying_leaves_the_log_untouched(self, log):
        before = snapshot(log)
        with OCELView(log) as view:
            view.apply(KeepIds(EVENTS_TABLE, {"e1"}), Clean())
            assert event_ids(view) == {"e1"}
        assert snapshot(log) == before

    def test_the_log_file_is_never_written(self, file_log):
        before = _file_hash(file_log)
        with OCELView(file_log) as view:
            view.apply(KeepIds(EVENTS_TABLE, {"e1"}), Clean())
        assert _file_hash(file_log) == before

    def test_views_of_one_log_do_not_affect_each_other(self, log):
        with OCELView(log) as first, OCELView(log) as second:
            first.apply(KeepIds(EVENTS_TABLE, {"e1"}))
            second.apply(KeepIds(EVENTS_TABLE, {"e2"}))
            assert event_ids(first) == {"e1"}
            assert event_ids(second) == {"e2"}


class TestApply:
    def test_each_operation_reads_what_the_one_before_left(self, log):
        with OCELView(log) as view:
            view.apply(UppercaseActivities(), KeepActivity("PAY"))
            assert event_ids(view) == {"e3"}

    def test_operations_in_the_other_order_give_another_result(self, log):
        with OCELView(log) as view:
            view.apply(KeepActivity("PAY"), UppercaseActivities())
            assert event_ids(view) == set()

    def test_separate_applies_equal_one_apply(self, make_log):
        with (
            OCELView(make_log(**ORDERS)) as together,
            OCELView(make_log(**ORDERS)) as apart,
        ):
            together.apply(KeepIds(OBJECTS_TABLE, {"o1"}), Clean())
            apart.apply(KeepIds(OBJECTS_TABLE, {"o1"}))
            apart.apply(Clean())
            assert snapshot(together) == snapshot(apart)

    def test_tables_point_at_the_last_step(self, log):
        with OCELView(log) as view:
            before = view.tables
            view.apply(KeepIds(EVENTS_TABLE, {"e1"}))
            after = view.tables
            assert after[EVENTS_TABLE] != before[EVENTS_TABLE]
            assert {t: r for t, r in after.items() if t != EVENTS_TABLE} == {
                t: r for t, r in before.items() if t != EVENTS_TABLE
            }

    def test_changing_the_returned_tables_does_not_change_the_view(self, log):
        with OCELView(log) as view:
            before = dict(view.tables)
            view.tables[EVENTS_TABLE] = "nothing"
            assert view.tables == before


class TestQuery:
    def test_sql_binds_parameters(self, log):
        with OCELView(log) as view:
            rows = view.sql(
                f"SELECT {ident(EID_COL)} FROM {EVENTS_TABLE} "
                f"WHERE {ident(ACTIVITY_COL)} = ?",
                ["pay"],
            ).fetchall()
            assert rows == [("e3",)]


class TestClose:
    def test_close_detaches_the_view_from_a_memory_log(self, memory_log):
        before = _databases(memory_log)
        view = OCELView(memory_log)
        assert len(_databases(memory_log)) == len(before) + 1

        view.close()
        assert _databases(memory_log) == before

    def test_a_view_of_a_file_log_attaches_nothing_to_it(self, file_log):
        before = _databases(file_log)
        with OCELView(file_log):
            assert _databases(file_log) == before

    def test_close_closes_the_views_own_connection(self, file_log):
        view = OCELView(file_log)
        assert event_ids(view) == {"e1", "e2", "e3"}

        view.close()
        with pytest.raises(duckdb.ConnectionException):
            view.sql(f"FROM {EVENTS_TABLE}")

    def test_leaving_the_with_block_closes_the_view(self, memory_log):
        before = _databases(memory_log)
        with OCELView(memory_log):
            assert len(_databases(memory_log)) == len(before) + 1
        assert _databases(memory_log) == before


class TestExport:
    def test_to_ocel_outlives_the_view(self, log):
        with OCELView(log) as view:
            view.apply(KeepIds(OBJECTS_TABLE, {"o1"}), Clean())
            copy = view.to_ocel()
        with copy:
            assert event_ids(copy) == {"e1", "e3"}
            assert object_ids(copy) == {"o1"}

    def test_ocel_reads_the_view(self, file_log):
        with OCELView(file_log) as view:
            view.apply(KeepIds(EVENTS_TABLE, {"e3"}), Clean())
            with view.ocel() as ocel:
                assert event_ids(ocel) == {"e3"}
                assert ocel.events.count == 1

    def test_ocel_is_refused_for_a_memory_log(self, memory_log):
        with OCELView(memory_log) as view, pytest.raises(ValueError):
            view.ocel()


class TestSaveAndLoad:
    def test_a_loaded_view_shows_what_was_saved(self, file_log, tmp_path):
        saved = tmp_path / "view.duckdb"
        with OCELView(file_log) as view:
            view.apply(KeepIds(EVENTS_TABLE, {"e1", "e2"}), Clean())
            view.save(saved)
            expected = snapshot(view)
        with OCELView.load(saved) as loaded:
            assert snapshot(loaded) == expected

    def test_a_loaded_view_works_as_an_ocel(self, file_log, tmp_path):
        saved = tmp_path / "view.duckdb"
        with OCELView(file_log) as view:
            view.apply(KeepIds(EVENTS_TABLE, {"e1", "e2"}), Clean())
            view.save(saved)
        with OCELView.load(saved) as loaded:
            assert loaded.events.count == 2
            assert loaded.objects.count == 3

    def test_save_is_refused_for_a_memory_log(self, memory_log, tmp_path):
        with OCELView(memory_log) as view, pytest.raises(ValueError):
            view.save(tmp_path / "view.duckdb")

    def test_load_refuses_a_plain_log(self, memory_log, tmp_path):
        plain = tmp_path / "plain.duckdb"
        memory_log.to_duckdb(plain)
        with pytest.raises(duckdb.CatalogException):
            OCELView.load(plain)

    def test_materialize_writes_a_standalone_log(self, file_log, tmp_path):
        saved, written = tmp_path / "view.duckdb", tmp_path / "log.duckdb"
        with OCELView(file_log) as view:
            view.apply(KeepIds(OBJECTS_TABLE, {"o2"}), Clean())
            view.save(saved)
            expected = snapshot(view)
        OCELView.materialize(saved, written)

        saved.unlink()
        _path(file_log).unlink()
        with OCEL.read_duckdb(written, read_only=True) as materialized:
            assert snapshot(materialized) == expected
