from __future__ import annotations

import multiprocessing
import os
import shutil
import signal
import tempfile
import threading
import traceback
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from multiprocessing.process import BaseProcess
from pathlib import Path
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from ocelescope import ResourceBase
from ocelescope_backend.app.internal.config import config
from ocelescope_backend.app.internal.registry import resource_registry
from ocelescope_backend.app.internal.tasks import child
from ocelescope_backend.app.internal.tasks.child import WrittenOutput
from ocelescope_backend.app.internal.tasks.store import (
    TaskRecord,
    TaskState,
    task_store,
)
from ocelescope_backend.app.sse_manager import (
    ErrorNotification,
    InvalidationRequest,
    SSEMessage,
    sse_manager,
)

if TYPE_CHECKING:
    from ocelescope_backend.app.internal.session import Session

PRELOAD = ["ocelescope", "ocelescope_backend.app.internal.tasks.child"]
KILL_TIMEOUT = 5.0

Outcome = tuple[Any, ...] | None


def _now() -> str:
    return datetime.now(tz=UTC).isoformat()


def _signal_group(process: BaseProcess, sig: signal.Signals) -> None:
    if process.pid is None:
        return
    try:
        os.killpg(process.pid, sig)
    except ProcessLookupError:
        if process.is_alive():
            os.kill(process.pid, sig)


def _stop(process: BaseProcess) -> None:
    _signal_group(process, signal.SIGTERM)
    process.join(KILL_TIMEOUT)
    if process.is_alive():
        _signal_group(process, signal.SIGKILL)


class TaskRunner:
    def __init__(self, max_concurrent: int) -> None:
        self._mp = multiprocessing.get_context("forkserver")
        self._mp.set_forkserver_preload(PRELOAD)
        self._pool = ThreadPoolExecutor(
            max_workers=max_concurrent, thread_name_prefix="task"
        )
        self._processes: dict[str, BaseProcess] = {}
        self._cancelled: set[str] = set()
        self._output_dirs: set[Path] = set()
        self._lock = threading.Lock()

    def submit(
        self,
        session: Session,
        *,
        function_ref: str,
        name: str,
        arguments: dict[str, Any],
        hidden: bool = False,
        dedupe_key: str | None = None,
    ) -> str:
        if dedupe_key is not None and (
            existing := task_store.find_duplicate(session.id, dedupe_key)
        ):
            return existing.id

        record = TaskRecord(
            id=str(uuid4()),
            session_id=session.id,
            name=name,
            arguments=arguments,
            dedupe_key=dedupe_key,
        )
        task_store.add(record)
        self._pool.submit(self._supervise, session, record, function_ref, hidden)
        self._invalidate(session.id)
        return record.id

    def cancel(self, task_id: str) -> None:
        with self._lock:
            self._cancelled.add(task_id)
            process = self._processes.get(task_id)
        if process is not None:
            threading.Thread(target=_stop, args=(process,), daemon=True).start()
        record = task_store.get(task_id)
        if record is not None and record.state == TaskState.PENDING:
            task_store.update(task_id, state=TaskState.CANCELLED, finished_at=_now())
            self._invalidate(record.session_id)

    def cancel_session(self, session_id: str) -> None:
        for record in task_store.query(session_id):
            self.cancel(record.id)
        task_store.drop_session(session_id)

    def shutdown(self) -> None:
        with self._lock:
            processes = list(self._processes.values())
            output_dirs = list(self._output_dirs)
        for process in processes:
            _signal_group(process, signal.SIGKILL)
        self._pool.shutdown(wait=False, cancel_futures=True)
        for output_dir in output_dirs:
            shutil.rmtree(output_dir, ignore_errors=True)

    def _is_cancelled(self, task_id: str) -> bool:
        with self._lock:
            return task_id in self._cancelled

    def _invalidate(self, session_id: str) -> None:
        sse_manager.send_safe(session_id, InvalidationRequest(routes=["tasks"]))

    def _supervise(
        self,
        session: Session,
        record: TaskRecord,
        function_ref: str,
        hidden: bool,
    ) -> None:
        if self._is_cancelled(record.id):
            with self._lock:
                self._cancelled.discard(record.id)
            return
        output_dir = Path(tempfile.mkdtemp(prefix=f"ocelescope_task_{record.id}_"))
        with self._lock:
            self._output_dirs.add(output_dir)
        try:
            outcome, held, exitcode = self._run_process(
                session, record, function_ref, output_dir
            )
            self._finish(session, record, outcome, held, exitcode, hidden)
        finally:
            shutil.rmtree(output_dir, ignore_errors=True)
            with self._lock:
                self._output_dirs.discard(output_dir)
                self._cancelled.discard(record.id)
            self._invalidate(session.id)

    def _run_process(
        self,
        session: Session,
        record: TaskRecord,
        function_ref: str,
        output_dir: Path,
    ) -> tuple[Outcome, list[SSEMessage], int | None]:
        reader, writer = self._mp.Pipe(duplex=False)
        process = self._mp.Process(
            target=child.run,
            args=(
                function_ref,
                record.id,
                record.name,
                record.arguments,
                output_dir,
                writer,
            ),
        )
        with self._lock:
            if record.id in self._cancelled:
                return None, [], None
            process.start()
            self._processes[record.id] = process
        writer.close()
        task_store.update(record.id, state=TaskState.STARTED, started_at=_now())
        self._invalidate(session.id)

        outcome: Outcome = None
        held: list[SSEMessage] = []
        try:
            while outcome is None:
                try:
                    message = reader.recv()
                except EOFError:
                    break
                if message[0] != "notify":
                    outcome = message
                elif getattr(message[1], "link", None) is not None:
                    held.append(message[1])
                else:
                    sse_manager.send_safe(session.id, message[1])
        finally:
            reader.close()
            process.join()
            with self._lock:
                self._processes.pop(record.id, None)
        return outcome, held, process.exitcode

    def _finish(
        self,
        session: Session,
        record: TaskRecord,
        outcome: Outcome,
        held: list[SSEMessage],
        exitcode: int | None,
        hidden: bool,
    ) -> None:
        written: list[WrittenOutput] = (
            outcome[1] if outcome is not None and outcome[0] == "done" else []
        )
        try:
            if self._is_cancelled(record.id):
                task_store.update(
                    record.id, state=TaskState.CANCELLED, finished_at=_now()
                )
                return
            if outcome is None:
                self._fail(
                    session,
                    record,
                    f"The task process exited unexpectedly (exit code {exitcode})",
                    "",
                )
                return
            if outcome[0] == "failed":
                self._fail(session, record, outcome[1], outcome[2])
                return
            try:
                self._commit(session, record, written, hidden)
            except Exception as exc:
                self._fail(session, record, str(exc), traceback.format_exc())
                return
        finally:
            for output in written:
                if output.kind == "resource_file":
                    output.path.unlink(missing_ok=True)

        task_store.update(record.id, state=TaskState.SUCCESS, finished_at=_now())
        for notification in held:
            sse_manager.send_safe(session.id, notification)

    def _fail(
        self, session: Session, record: TaskRecord, message: str, trace: str
    ) -> None:
        task_store.update(record.id, state=TaskState.FAILURE, finished_at=_now())
        sse_manager.send_safe(
            session.id,
            ErrorNotification(
                type="error",
                title=f"Task '{record.name}' failed",
                message=message,
                trace=trace,
            ),
        )

    def _commit(
        self,
        session: Session,
        record: TaskRecord,
        written: list[WrittenOutput],
        hidden: bool,
    ) -> None:
        added: list[WrittenOutput] = []
        try:
            for output in written:
                if output.kind == "ocel":
                    session.register_ocel(
                        output.id,
                        output.path,
                        output.name,
                        source_id=record.id,
                        hidden=hidden,
                    )
                else:
                    schema_hash = output.schema_hash or _validate_resource_file(
                        output.path
                    )
                    resource_registry.get_resource_class(schema_hash)
                    session.register_resource(
                        output.id,
                        output.path,
                        output.name,
                        schema_hash,
                        source_id=record.id,
                        hidden=hidden,
                    )
                added.append(output)
        except Exception:
            for output in added:
                if output.kind == "ocel":
                    session.delete_ocel(output.id)
                else:
                    session.delete_resource(output.id)
            raise


def _validate_resource_file(path: Path) -> str:
    schema_hash = ResourceBase.read_schema_hash(path)
    resource_class = resource_registry.get_resource_class(schema_hash)
    with resource_class.read(path, resolve=resource_registry.get_resource_class):
        pass
    return schema_hash


task_runner = TaskRunner(config.MAX_CONCURRENT_TASKS)
