import json
import shutil
import tempfile
import traceback
import zipfile
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Literal
from uuid import uuid4

from typing_extensions import TypedDict

from ocelescope import OCEL
from ocelescope_backend.app.internal.config import config
from ocelescope_backend.app.internal.model.resource import ResourceStore
from ocelescope_backend.app.internal.registry import registry_manager
from ocelescope_backend.app.internal.session import Session
from ocelescope_backend.app.internal.tasks.system import system_task
from ocelescope_backend.app.internal.util.archive import (
    ArchiveContents,
    ArchiveError,
    ArchiveKind,
    extract_archive,
    extract_member,
    inspect_archive,
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

    match original_name.suffix:
        case ".xml":
            desired_suffix = ".xmlocel"
        case ".json":
            desired_suffix = ".jsonocel"
        case _:
            desired_suffix = original_name.suffix

    name = original_name.stem
    read_path = file_path
    try:
        if file_path.suffix != desired_suffix:
            read_path = file_path.with_suffix(desired_suffix)
            file_path.rename(read_path)

        ocel_id = session.add_ocel_from_file(
            read_path,
            name=name,
        )

    finally:
        read_path.unlink(missing_ok=True)
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


def _inspect_zip(file_path: Path) -> tuple[zipfile.ZipFile, ArchiveContents]:
    try:
        archive = zipfile.ZipFile(file_path, "r")
    except zipfile.BadZipFile as exc:
        raise ArchiveError("The uploaded file is not a valid zip archive") from exc

    try:
        contents = inspect_archive(
            archive,
            max_files=config.ARCHIVE_MAX_FILES,
            max_uncompressed_bytes=config.ARCHIVE_MAX_UNCOMPRESSED_BYTES,
        )
    except Exception:
        archive.close()
        raise
    return archive, contents


def _import_plugin_archive(
    session: Session,
    file_path: Path,
    metadata: ImportMetadata,
    archive: zipfile.ZipFile | None = None,
) -> list[SystemNotification | ErrorNotification | InvalidationRequest]:
    added_plugin_ids = []

    if not config.PLUGIN_DIR:
        raise RuntimeError("Plugin uploads are disabled on this deployment")

    with tempfile.TemporaryDirectory() as temp_dir:
        owns_archive = archive is None
        if archive is None:
            archive, contents = _inspect_zip(file_path)
            if contents.kind != ArchiveKind.PLUGIN:
                archive.close()
                raise ArchiveError("The uploaded archive is not a plugin")

        try:
            extract_archive(
                archive,
                Path(temp_dir),
                max_uncompressed_bytes=config.ARCHIVE_MAX_UNCOMPRESSED_BYTES,
            )
        finally:
            if owns_archive:
                archive.close()

        for plugin_candidate in Path(temp_dir).iterdir():
            if (
                plugin_candidate.is_dir()
                and (plugin_candidate / "__init__.py").exists()
            ):
                plugin_id = f"plugin_{str(uuid4())}"
                shutil.move(plugin_candidate, config.PLUGIN_DIR / plugin_id)
                added_plugin_ids.append(plugin_id)
    results: list[SystemNotification | ErrorNotification | InvalidationRequest] = []
    loaded_plugin_ids: list[str] = []
    for plugin_id in added_plugin_ids:
        try:
            loaded_plugin_ids.extend(
                registry_manager.load_plugins([plugin_id], ignore_errors=False)
            )
        except Exception as exc:
            results.append(
                ErrorNotification(
                    type="error",
                    title=f"Error while uploading plugin {metadata['fileName']}",
                    message=str(exc),
                    trace=traceback.format_exc(),
                )
            )

    loaded_plugins = [
        plugin.label
        for id in loaded_plugin_ids
        if (plugin := registry_manager.get_plugin(id)) is not None
    ]

    if len(loaded_plugins) == 0:
        if not results:
            results.append(
                SystemNotification(
                    type="notification",
                    title="Uploaded zip didn't contain any plugins",
                    notification_type="error",
                    message=f"The uploaded file {metadata['fileName']} did not contain any valid plugins",
                )
            )
        return results

    results.extend(
        [
            SystemNotification(
                title="Plugin successfully uploaded",
                message=f"Successfully uploaded {' '.join(loaded_plugins)}",
                notification_type="info",
            ),
            InvalidationRequest(routes=["plugins", "tasks", "discoveryMethods"]),
        ]
    )
    return results


@system_task(name="importPlugin")
def import_plugin(
    session: Session,
    file_path: Path,
    metadata: ImportMetadata,
):
    try:
        return _import_plugin_archive(session, file_path, metadata)
    finally:
        file_path.unlink(missing_ok=True)


def _archived_member_suffix(filename: str) -> str:
    lower_name = filename.lower()
    return ".xes.gz" if lower_name.endswith(".xes.gz") else Path(lower_name).suffix


def _import_resource(
    session: Session,
    file_path: Path,
) -> list[SystemNotification | InvalidationRequest]:
    try:
        data = json.loads(file_path.read_text())
        resource = ResourceStore(**data)
    finally:
        file_path.unlink(missing_ok=True)

    session.add_resource(resource)
    return [
        SystemNotification(
            title="Resource successfully uploaded",
            message=f"{resource.name} uploaded successfully",
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
                member_results = _import_resource(session, temp_path)
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
        archive, contents = _inspect_zip(file_path)
        with archive:
            if contents.kind == ArchiveKind.PLUGIN:
                return _import_plugin_archive(
                    session, file_path, metadata, archive=archive
                )
            return _import_archived_data(session, archive, contents, metadata)
    finally:
        file_path.unlink(missing_ok=True)


@system_task(name="importResource")
def import_resource(
    session: Session,
    file_path: Path,
    metadata: ImportMetadata,
):
    return _import_resource(session, file_path)
