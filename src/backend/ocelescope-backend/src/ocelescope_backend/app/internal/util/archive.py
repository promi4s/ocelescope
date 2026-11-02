import stat
import zipfile
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path, PurePosixPath


class ArchiveError(ValueError):
    """Raised when an uploaded archive is invalid or unsafe."""


class ArchiveKind(StrEnum):
    LOGS = "logs"
    MIXED = "mixed"
    RESOURCES = "resources"


@dataclass(frozen=True)
class ArchiveContents:
    kind: ArchiveKind
    log_members: tuple[zipfile.ZipInfo, ...] = ()
    resource_members: tuple[zipfile.ZipInfo, ...] = ()


_IGNORED_PATH_PARTS = {"__MACOSX"}
_LOG_SUFFIXES = {
    ".csv",
    ".json",
    ".jsonocel",
    ".sqlite",
    ".xes",
    ".xml",
    ".xmlocel",
}
# Formats whose last extension alone ('.zip', '.gz') says nothing about the file.
_COMPOUND_LOG_SUFFIXES = (".ocel.zip", ".xes.gz")
_RESOURCE_SUFFIX = ".ocelescope"


def _safe_member_path(info: zipfile.ZipInfo) -> PurePosixPath:
    # ZIP member names are POSIX paths. Backslashes are rejected rather than
    # normalized so the same archive cannot mean different things per platform.
    if "\\" in info.filename or "\0" in info.filename:
        raise ArchiveError(f"Archive contains an unsafe path: {info.filename!r}")

    path = PurePosixPath(info.filename)
    if path.is_absolute() or ".." in path.parts:
        raise ArchiveError(f"Archive contains an unsafe path: {info.filename!r}")

    if not path.parts or path == PurePosixPath("."):
        raise ArchiveError("Archive contains an empty member path")

    mode = info.external_attr >> 16
    if stat.S_ISLNK(mode):
        raise ArchiveError(f"Archive contains a symbolic link: {info.filename!r}")

    if info.flag_bits & 0x1:
        raise ArchiveError(f"Archive contains an encrypted file: {info.filename!r}")

    return path


def is_ignored(path: PurePosixPath) -> bool:
    return any(
        part in _IGNORED_PATH_PARTS or part.startswith("._") for part in path.parts
    )


def _is_supported_log(path: PurePosixPath) -> bool:
    lower_name = path.name.lower()
    return (
        lower_name.endswith(_COMPOUND_LOG_SUFFIXES)
        or Path(lower_name).suffix in _LOG_SUFFIXES
    )


def validate_archive(
    archive: zipfile.ZipFile,
    *,
    max_files: int,
    max_uncompressed_bytes: int,
) -> list[tuple[zipfile.ZipInfo, PurePosixPath]]:
    """Validate an uploaded ZIP without extracting it; returns its usable members."""
    infos = archive.infolist()
    if not infos:
        raise ArchiveError("The uploaded zip archive is empty")

    file_count = 0
    total_size = 0
    seen_paths: set[PurePosixPath] = set()
    paths: list[tuple[zipfile.ZipInfo, PurePosixPath]] = []

    for info in infos:
        path = _safe_member_path(info)
        if path in seen_paths:
            raise ArchiveError(f"Archive contains a duplicate path: {info.filename!r}")
        seen_paths.add(path)

        if is_ignored(path):
            continue

        paths.append((info, path))
        if not info.is_dir():
            file_count += 1
            total_size += info.file_size

        if file_count > max_files:
            raise ArchiveError(
                f"Archive contains more than the allowed {max_files} files"
            )
        if total_size > max_uncompressed_bytes:
            raise ArchiveError(
                "Archive expands beyond the configured size limit "
                f"of {max_uncompressed_bytes} bytes"
            )

    if not paths:
        raise ArchiveError("The uploaded zip archive contains no usable files")

    return paths


def classify_archive(
    paths: list[tuple[zipfile.ZipInfo, PurePosixPath]],
) -> ArchiveContents:
    """Sort validated members into the logs and resources Ocelescope imports."""
    log_members = tuple(
        info for info, path in paths if not info.is_dir() and _is_supported_log(path)
    )
    resource_members = tuple(
        info
        for info, path in paths
        if not info.is_dir() and path.name.lower().endswith(_RESOURCE_SUFFIX)
    )

    if log_members and resource_members:
        kind = ArchiveKind.MIXED
    elif log_members:
        kind = ArchiveKind.LOGS
    elif resource_members:
        kind = ArchiveKind.RESOURCES
    else:
        raise ArchiveError("Archive contains no supported log or resource file")

    return ArchiveContents(
        kind=kind,
        log_members=log_members,
        resource_members=resource_members,
    )


def extract_archive(
    archive: zipfile.ZipFile,
    destination: Path,
    *,
    max_uncompressed_bytes: int,
) -> None:
    """Extract a previously inspected archive while enforcing the size limit."""
    written = 0
    destination = destination.resolve()

    for info in archive.infolist():
        member_path = _safe_member_path(info)
        if is_ignored(member_path):
            continue

        target = destination.joinpath(*member_path.parts)
        if info.is_dir():
            target.mkdir(parents=True, exist_ok=True)
            continue

        target.parent.mkdir(parents=True, exist_ok=True)
        with archive.open(info, "r") as source, target.open("xb") as output:
            while chunk := source.read(1024 * 1024):
                written += len(chunk)
                if written > max_uncompressed_bytes:
                    raise ArchiveError(
                        "Archive expanded beyond the configured size limit "
                        f"of {max_uncompressed_bytes} bytes"
                    )
                output.write(chunk)


def extract_member(
    archive: zipfile.ZipFile,
    info: zipfile.ZipInfo,
    destination: Path,
    *,
    max_uncompressed_bytes: int,
) -> None:
    """Stream one validated member to a caller-owned destination file."""
    _safe_member_path(info)
    written = 0
    with archive.open(info, "r") as source, destination.open("xb") as output:
        while chunk := source.read(1024 * 1024):
            written += len(chunk)
            if written > max_uncompressed_bytes:
                raise ArchiveError(
                    "Archived file expanded beyond the configured size limit "
                    f"of {max_uncompressed_bytes} bytes"
                )
            output.write(chunk)
