import traceback
import zipfile
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Literal

from typing_extensions import TypedDict

from ocelescope import OCEL, ResourceBase
from ocelescope_backend.app.internal.config import config
from ocelescope_backend.app.internal.registry import (
    archive_handlers,
    resource_registry,
)
from ocelescope_backend.app.internal.session import Session
from ocelescope_backend.app.internal.tasks.system import system_task
from ocelescope_backend.app.internal.util.archive import (
    ArchiveContents,
    ArchiveError,
    classify_archive,
    extract_member,
    validate_archive,
)
from ocelescope_backend.app.sse_manager import (
    ErrorNotification,
    InvalidationRequest,
    OcelLink,
    SystemNotification,
)


class ImportMetadata(TypedDict):
    fileName: str
    uploaded_at: str


def _import_ocel(
    session: Session,
    file_path: Path,
    metadata: ImportMetadata,
) -> list[SystemNotification | InvalidationRequest]:
    original_name = Path(metadata["fileName"])

    name = original_name.stem
    # "foo.ocel.zip" names the log "foo", not "foo.ocel".
    if name.lower().endswith(".ocel"):
        name = name[: -len(".ocel")]

    try:
        # Streamed entity by entity, so the upload is never held in memory whole.
        with OCEL.read(file_path) as ocel:
            ocel_id = session.add_ocel(ocel, name=name)
    finally:
        file_path.unlink(missing_ok=True)

    return [
        SystemNotification(
            title="OCEL successfully uploaded",
            message=f"{name} was uploaded successfully",
            notification_type="info",
            link=OcelLink(ocel_id=ocel_id),
        ),
        InvalidationRequest(routes=["ocels", "tasks"]),
    ]


@system_task(name="importOCEL")
def import_ocel_task(
    session: Session,
    file_path: Path,
    metadata: ImportMetadata,
):
    return _import_ocel(session, file_path, metadata)


def _import_xes(
    session: Session,
    file_path: Path,
    metadata: ImportMetadata,
) -> list[SystemNotification | InvalidationRequest]:
    original_name = Path(metadata["fileName"])

    try:
        ocel = OCEL.read_xes(
            file_path,
        )
    finally:
        file_path.unlink(missing_ok=True)

    with ocel:
        ocel_id = session.add_ocel(ocel, name=original_name.stem)

    return [
        SystemNotification(
            title="XES was uploaded successfully",
            message=f"{original_name.stem} was uploaded successfully",
            notification_type="info",
            link=OcelLink(ocel_id=ocel_id),
        ),
        InvalidationRequest(routes=["ocels", "tasks"]),
    ]


@system_task(name="importXES")
def import_xes_task(
    session: Session,
    file_path: Path,
    metadata: ImportMetadata,
):
    return _import_xes(session, file_path, metadata)


def _open_zip(file_path: Path) -> zipfile.ZipFile:
    try:
        return zipfile.ZipFile(file_path, "r")
    except zipfile.BadZipFile as exc:
        raise ArchiveError("The uploaded file is not a valid zip archive") from exc


def _archived_member_suffix(filename: str) -> str:
    lower_name = filename.lower()
    return ".xes.gz" if lower_name.endswith(".xes.gz") else Path(lower_name).suffix


def _import_resource(
    session: Session, file_path: Path, name: str, source_id: str | None = None
) -> list[SystemNotification | InvalidationRequest]:
    try:
        if zipfile.is_zipfile(file_path):
            with zipfile.ZipFile(file_path) as archive:
                size = sum(member.file_size for member in archive.infolist())
            if size > config.ARCHIVE_MAX_UNCOMPRESSED_BYTES:
                raise ArchiveError("The uploaded resource is too large to unpack")

        resource_class = resource_registry.get_resource_class(
            ResourceBase.read_schema_hash(file_path)
        )
        with resource_class.read(
            file_path, resolve=resource_registry.get_resource_class
        ) as resource:
            session.add_resource(resource, name=name, source_id=source_id)
    finally:
        file_path.unlink(missing_ok=True)

    return [
        SystemNotification(
            title="Resource successfully uploaded",
            message=f"{name} uploaded successfully",
            notification_type="info",
        ),
        InvalidationRequest(routes=["resources", "tasks"]),
    ]


def _import_archived_data(
    session: Session,
    archive: zipfile.ZipFile,
    contents: ArchiveContents,
    metadata: ImportMetadata,
) -> list[SystemNotification | ErrorNotification | InvalidationRequest]:
    results: list[SystemNotification | ErrorNotification | InvalidationRequest] = []
    imported_ocel = False
    imported_resource = False

    members = sorted(
        (*contents.log_members, *contents.resource_members),
        key=lambda member: member.header_offset,
    )
    for member in members:
        member_name = Path(member.filename).name
        suffix = _archived_member_suffix(member_name)
        temp_path: Path | None = None
        try:
            with NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                temp_path = Path(temp_file.name)
            temp_path.unlink()
            extract_member(
                archive,
                member,
                temp_path,
                max_uncompressed_bytes=config.ARCHIVE_MAX_UNCOMPRESSED_BYTES,
            )

            member_metadata: ImportMetadata = {
                "fileName": member_name,
                "uploaded_at": metadata["uploaded_at"],
            }
            if suffix == ".ocelescope":
                member_results = _import_resource(
                    session=session,
                    file_path=temp_path,
                    name=Path(member_name).stem,
                )
                imported_resource = True
            elif suffix in {".xes", ".xes.gz"}:
                member_results = _import_xes(session, temp_path, member_metadata)
                imported_ocel = True
            else:
                member_results = _import_ocel(session, temp_path, member_metadata)
                imported_ocel = True

            results.extend(
                result
                for result in member_results
                if not isinstance(result, InvalidationRequest)
            )
        except Exception as exc:
            if temp_path is not None:
                temp_path.unlink(missing_ok=True)
            results.append(
                ErrorNotification(
                    type="error",
                    title=f"Could not import {member_name}",
                    message=str(exc),
                    trace=traceback.format_exc(),
                )
            )

    invalidation_routes: list[Literal["ocels", "resources", "tasks"]] = []
    if imported_ocel:
        invalidation_routes.append("ocels")
    if imported_resource:
        invalidation_routes.append("resources")
    if invalidation_routes:
        results.append(InvalidationRequest(routes=[*invalidation_routes, "tasks"]))
    return results


@system_task(name="importArchive")
def import_archive(
    session: Session,
    file_path: Path,
    metadata: ImportMetadata,
):
    try:
        with _open_zip(file_path) as archive:
            members = validate_archive(
                archive,
                max_files=config.ARCHIVE_MAX_FILES,
                max_uncompressed_bytes=config.ARCHIVE_MAX_UNCOMPRESSED_BYTES,
            )

            for handler in archive_handlers:
                if (results := handler(session, archive, metadata)) is not None:
                    return results

            return _import_archived_data(
                session, archive, classify_archive(members), metadata
            )
    finally:
        file_path.unlink(missing_ok=True)


@system_task(name="importResource")
def import_resource(
    session: Session,
    file_path: Path,
    metadata: ImportMetadata,
    task_id: str | None = None,
):
    name = Path(metadata["fileName"]).stem
    return _import_resource(
        session=session, file_path=file_path, name=name, source_id=task_id
    )
