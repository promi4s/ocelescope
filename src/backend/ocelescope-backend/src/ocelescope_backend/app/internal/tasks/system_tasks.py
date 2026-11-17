import json
import traceback
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory

import duckdb
from ocelescope.util.sql import ident, literal

from ocelescope import OCEL, ResourceBase
from ocelescope_backend.app.internal.config import config
from ocelescope_backend.app.internal.tasks.context import task_context
from ocelescope_backend.app.internal.tasks.decorator import task
from ocelescope_backend.app.internal.tasks.outputs import Output, TaskResult
from ocelescope_backend.app.internal.util.archive import (
    ArchiveError,
    classify_archive,
    extract_member,
    validate_archive,
)
from ocelescope_backend.app.sse_manager import ErrorNotification, SystemNotification


def _log_name(file_name: str) -> str:
    name = Path(file_name).stem
    return name[: -len(".ocel")] if name.lower().endswith(".ocel") else name


def _read_log(file_path: Path, file_name: str, xes: bool) -> Output:
    name = Path(file_name).stem if xes else _log_name(file_name)
    ocel = OCEL.read_xes(file_path) if xes else OCEL.read(file_path)
    task_context().notify(
        SystemNotification(
            title="XES was uploaded successfully"
            if xes
            else "OCEL successfully uploaded",
            message=f"{name} was uploaded successfully",
            notification_type="info",
        )
    )
    return Output(ocel, name=name)


def _read_resource(file_path: Path, file_name: str) -> Output:
    path = file_path
    if zipfile.is_zipfile(file_path):
        path = file_path.with_suffix(".duckdb")
        with (
            TemporaryDirectory(dir=task_context().work_dir) as tmp,
            zipfile.ZipFile(file_path) as archive,
        ):
            size = sum(member.file_size for member in archive.infolist())
            if size > config.ARCHIVE_MAX_UNCOMPRESSED_BYTES:
                raise ArchiveError("The uploaded resource is too large to unpack")

            manifest = json.loads(archive.read("manifest.json"))
            schema_hash = manifest["schema_hash"]
            con = duckdb.connect(str(path))
            try:
                for table in manifest["tables"]:
                    file = archive.extract(f"{table}.parquet", tmp)
                    con.sql(
                        f"CREATE TABLE {ident(table)} "
                        f"AS FROM read_parquet({literal(file)})"
                    )
            finally:
                con.close()
    else:
        schema_hash = ResourceBase.read_schema_hash(file_path)

    name = Path(file_name).stem
    task_context().notify(
        SystemNotification(
            title="Resource successfully uploaded",
            message=f"{name} uploaded successfully",
            notification_type="info",
        )
    )
    return Output((path, schema_hash), name=name)


@task(name="importOCEL")
def import_ocel(file_path: Path, file_name: str) -> TaskResult:
    return _read_log(file_path, file_name, xes=False)


@task(name="importXES")
def import_xes(file_path: Path, file_name: str) -> TaskResult:
    return _read_log(file_path, file_name, xes=True)


@task(name="importResource")
def import_resource(file_path: Path, file_name: str) -> TaskResult:
    return _read_resource(file_path, file_name)


@task(name="importArchive")
def import_archive(file_path: Path, file_name: str) -> TaskResult:
    try:
        archive = zipfile.ZipFile(file_path, "r")
    except zipfile.BadZipFile as exc:
        raise ArchiveError("The uploaded file is not a valid zip archive") from exc

    outputs: list[Output] = []
    work_dir = task_context().work_dir
    with archive:
        contents = classify_archive(
            validate_archive(
                archive,
                max_files=config.ARCHIVE_MAX_FILES,
                max_uncompressed_bytes=config.ARCHIVE_MAX_UNCOMPRESSED_BYTES,
            )
        )
        members = sorted(
            (*contents.log_members, *contents.resource_members),
            key=lambda member: member.header_offset,
        )
        for index, member in enumerate(members):
            member_name = Path(member.filename).name
            lower = member_name.lower()
            suffix = ".xes.gz" if lower.endswith(".xes.gz") else Path(lower).suffix
            member_path = work_dir / f"member_{index}{suffix}"
            try:
                extract_member(
                    archive,
                    member,
                    member_path,
                    max_uncompressed_bytes=config.ARCHIVE_MAX_UNCOMPRESSED_BYTES,
                )
                if suffix == ".ocelescope":
                    outputs.append(_read_resource(member_path, member_name))
                else:
                    outputs.append(
                        _read_log(
                            member_path,
                            member_name,
                            xes=suffix in {".xes", ".xes.gz"},
                        )
                    )
            except Exception as exc:
                task_context().notify(
                    ErrorNotification(
                        type="error",
                        title=f"Could not import {member_name}",
                        message=str(exc),
                        trace=traceback.format_exc(),
                    )
                )
    return outputs


SYSTEM_TASKS = [import_ocel, import_xes, import_resource, import_archive]
