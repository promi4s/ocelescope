from __future__ import annotations

from collections.abc import Callable, Iterator, Sequence
from pathlib import Path

import pytest
from ocel_testing import EventRow, ObjectRow, RelationRow, build_log
from ocelescope.ocel.core import OCEL

MakeLog = Callable[..., OCEL]


@pytest.fixture
def make_log(tmp_path: Path) -> Iterator[MakeLog]:
    built: list[OCEL] = []

    def factory(
        objects: Sequence[ObjectRow] = (),
        events: Sequence[EventRow] = (),
        e2o: Sequence[RelationRow] = (),
        o2o: Sequence[RelationRow] = (),
        on_disk: bool = False,
    ) -> OCEL:
        log = build_log(objects=objects, events=events, e2o=e2o, o2o=o2o)
        if on_disk:
            path = tmp_path / f"log_{len(built)}.duckdb"
            with log:
                log.to_duckdb(path)
            log = OCEL.read_duckdb(path, read_only=True)
        built.append(log)
        return log

    yield factory
    for log in built:
        log.close()
