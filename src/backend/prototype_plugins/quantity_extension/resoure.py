import datetime
import random
from typing import Literal
from ocelescope import Resource, Visualization
from ocelescope.visualization import Table, TableColumn


class Test(Resource):
    type: Literal["test"] = "test"

    def visualize(self) -> Visualization:
        columns = [
            TableColumn(id="id", label="ID", data_type="number"),
            TableColumn(id="name", label="Name", data_type="string"),
            TableColumn(id="score", label="Score", data_type="number"),
            TableColumn(id="active", label="Active", data_type="boolean"),
            TableColumn(id="signup_date", label="Signup Date", data_type="date"),
            TableColumn(id="last_login", label="Last Login", data_type="datetime"),
        ]

        names = [
            "Alice",
            "Bob",
            "Charlie",
            "Diana",
            "Ethan",
            "Fiona",
            "George",
            "Hannah",
        ]

        rows = []
        for i in range(1, 51):  # 50 rows
            signup = datetime.date(2024, random.randint(1, 12), random.randint(1, 28))
            last_login = datetime.datetime(
                2025,
                random.randint(1, 8),
                random.randint(1, 28),
                random.randint(0, 23),
                random.randint(0, 59),
            )
            rows.append(
                {
                    "id": i,
                    "name": random.choice(names),
                    "score": round(random.uniform(0, 100), 2),
                    "active": random.choice([True, False]),
                    "signup_date": signup.isoformat(),
                    "last_login": last_login.isoformat(),
                }
            )

        return Table(type="table", columns=columns, rows=rows)
