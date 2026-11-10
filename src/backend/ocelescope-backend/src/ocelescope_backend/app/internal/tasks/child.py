from __future__ import annotations

import importlib
import os
import shutil
import traceback
from contextlib import ExitStack
from dataclasses import dataclass
from multiprocessing.connection import Connection
from pathlib import Path
from typing import Any, Literal

from ocelescope import OCEL, ResourceBase
from ocelescope_backend.app.internal.tasks.context import (
    TaskContext,
    set_task_context,
)
from ocelescope_backend.app.internal.tasks.inputs import open_inputs
from ocelescope_backend.app.internal.tasks.outputs import Output, TaskResult


@dataclass(frozen=True)
class WrittenOutput:
    id: str
    name: str
    kind: Literal["ocel", "resource"]
    path: Path
    schema_hash: str | None = None
    imported: bool = False


def resolve_function(ref: str) -> Any:
    module_name, _, qualname = ref.partition(":")
    target: Any = importlib.import_module(module_name)
    for part in qualname.split("."):
        target = getattr(target, part)
    return getattr(target, "fn", target)


def _as_list(result: TaskResult) -> list[Output]:
    if result is None:
        return []
    if isinstance(result, Output):
        return [result]
    return list(result)


def _write(
    output: Output, index: int, task_name: str, output_dir: Path
) -> WrittenOutput:
    name = output.name or f"{task_name}_{index}"
    value = output.value
    if isinstance(value, OCEL):
        path = output_dir / f"{output.id}.duckdb"
        value.to_duckdb(path)
        return WrittenOutput(output.id, name, "ocel", path)
    path = output_dir / output.id
    if isinstance(value, ResourceBase):
        value.dump(path)
        return WrittenOutput(output.id, name, "resource", path, value.get_schema_hash())
    source, schema_hash = value
    shutil.move(source, path)
    return WrittenOutput(output.id, name, "resource", path, schema_hash, imported=True)


def run(
    function_ref: str,
    task_id: str,
    task_name: str,
    kwargs: dict[str, Any],
    output_dir: Path,
    channel: Connection,
) -> None:
    os.setpgrp()
    set_task_context(TaskContext(task_id, channel))
    outputs: list[Output] = []
    try:
        fn = resolve_function(function_ref)
        with ExitStack() as stack:
            kwargs = open_inputs(kwargs, stack)
            outputs = _as_list(fn(**kwargs))
            written = [
                _write(output, index, task_name, output_dir)
                for index, output in enumerate(outputs)
            ]
        channel.send(("done", written))
    except BaseException as exc:
        for output in outputs:
            if isinstance(output.value, tuple):
                output.value[0].unlink(missing_ok=True)
        channel.send(("failed", str(exc), traceback.format_exc()))
    finally:
        for output in outputs:
            if not isinstance(output.value, tuple):
                output.value.close()
        set_task_context(None)
        channel.close()
