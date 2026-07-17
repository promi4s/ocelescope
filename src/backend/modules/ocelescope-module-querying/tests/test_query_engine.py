import unittest

import pandas as pd
from ocelescope import OCEL

from ocelescope_module_querying.api.schemas import OcelQueryBody
from ocelescope_module_querying.infrastructure.query_engine import (
    describe_ocel,
    execute_query,
)


def make_ocel() -> OCEL:
    events = pd.DataFrame(
        {
            "ocel:eid": ["e1", "e2", "e3", "e4"],
            "ocel:timestamp": pd.to_datetime(
                ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04"],
                utc=True,
            ),
            "ocel:activity": ["Create", "Create", "Create", "Ship"],
            "cost": [1.0, 2.0, 3.0, None],
        }
    )
    objects = pd.DataFrame(
        {"ocel:oid": ["o1", "o2"], "ocel:type": ["Order", "Order"]}
    )
    relations = pd.DataFrame(
        {
            "ocel:eid": ["e1", "e2"],
            "ocel:oid": ["o1", "o2"],
            "ocel:qualifier": ["order", "order"],
            "ocel:activity": ["Create", "Create"],
            "ocel:type": ["Order", "Order"],
        }
    )
    return OCEL(events, objects, relations)


class QueryEngineTest(unittest.TestCase):
    def test_schema_describes_field_types_and_activity_availability(self) -> None:
        schema = describe_ocel(make_ocel())
        events = next(source for source in schema.sources if source.name == "events")
        timestamp = next(
            field for field in events.fields if field.name == "ocel:timestamp"
        )
        cost = next(field for field in events.fields if field.name == "cost")

        self.assertEqual(timestamp.type, "datetime")
        self.assertEqual(cost.type, "number")
        self.assertEqual(cost.entity_types, ["Create"])
        self.assertEqual(cost.types_by_entity, {"Create": "number"})

    def test_binned_query_includes_empty_bins_and_row_statistics(self) -> None:
        body = OcelQueryBody(
            source="events",
            filters=[{"field": "ocel:activity", "operator": "eq", "value": "Create"}],
            group_by=[{"field": "cost", "alias": "value", "bin": {"count": 5}}],
            measures=[{"operation": "count", "alias": "count"}],
            order_by=[{"field": "value_start"}],
        )

        result = execute_query(make_ocel(), body.to_domain())

        # Three non-null costs spread across five bins, empty bins reported as 0.
        self.assertEqual(len(result.rows), 5)
        self.assertEqual(sum(int(row["count"] or 0) for row in result.rows), 3)
        self.assertEqual(result.stats.filtered_rows, 3)
        self.assertEqual(result.stats.matched_rows, 3)

    def test_row_query_filters_projects_sorts_and_limits(self) -> None:
        body = OcelQueryBody(
            source="events",
            fields=["ocel:eid", "ocel:timestamp", "cost"],
            filters=[
                {"field": "ocel:activity", "operator": "eq", "value": "Create"},
                {"field": "cost", "operator": "gte", "value": 2},
            ],
            order_by=[{"field": "ocel:timestamp", "direction": "desc"}],
            limit=1,
        )

        result = execute_query(make_ocel(), body.to_domain())

        self.assertEqual(result.rows[0]["ocel:eid"], "e3")
        self.assertEqual(result.stats.result_rows, 2)
        self.assertTrue(result.stats.truncated)

    def test_filter_operators_handle_nulls_and_negation(self) -> None:
        def eids(**filter_body: object) -> set[str]:
            body = OcelQueryBody(
                source="events", fields=["ocel:eid"], filters=[filter_body]
            )
            result = execute_query(make_ocel(), body.to_domain())
            return {row["ocel:eid"] for row in result.rows}

        # neq keeps null-cost rows (pandas parity); is_null isolates them.
        self.assertEqual(
            eids(field="ocel:activity", operator="neq", value="Create"), {"e4"}
        )
        self.assertEqual(eids(field="cost", operator="is_null"), {"e4"})
        self.assertEqual(
            eids(field="cost", operator="between", value=[2, 3]), {"e2", "e3"}
        )
        self.assertEqual(
            eids(field="ocel:activity", operator="contains", value="reat"),
            {"e1", "e2", "e3"},
        )

    def test_group_by_with_measures_aggregates_per_activity(self) -> None:
        body = OcelQueryBody(
            source="events",
            group_by=[{"field": "ocel:activity", "alias": "activity"}],
            measures=[
                {"operation": "count", "alias": "events"},
                {"operation": "avg", "field": "cost", "alias": "avg_cost"},
                {"operation": "count_distinct", "field": "cost", "alias": "distinct"},
            ],
            order_by=[{"field": "activity"}],
        )

        result = execute_query(make_ocel(), body.to_domain())
        by_activity = {row["activity"]: row for row in result.rows}

        self.assertEqual(by_activity["Create"]["events"], 3)
        self.assertEqual(by_activity["Create"]["avg_cost"], 2.0)
        self.assertEqual(by_activity["Create"]["distinct"], 3)
        # Ship has one event whose cost is null: counted, but no distinct value.
        self.assertEqual(by_activity["Ship"]["events"], 1)
        self.assertEqual(by_activity["Ship"]["distinct"], 0)

    def test_time_unit_grouping_buckets_events_by_day(self) -> None:
        body = OcelQueryBody(
            source="events",
            group_by=[
                {"field": "ocel:timestamp", "alias": "day", "time_unit": "day"}
            ],
            measures=[{"operation": "count", "alias": "count"}],
            order_by=[{"field": "day"}],
        )

        result = execute_query(make_ocel(), body.to_domain())

        self.assertEqual(len(result.rows), 4)
        self.assertTrue(all(row["count"] == 1 for row in result.rows))


if __name__ == "__main__":
    unittest.main()
