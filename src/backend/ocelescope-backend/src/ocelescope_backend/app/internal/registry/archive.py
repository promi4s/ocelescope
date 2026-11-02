from __future__ import annotations

import zipfile
from collections.abc import Callable
from typing import TYPE_CHECKING, TypeAlias

if TYPE_CHECKING:
    from ocelescope_backend.app.internal.session import Session
    from ocelescope_backend.app.internal.tasks.system_tasks import ImportMetadata
    from ocelescope_backend.app.sse_manager import SSEMessage

ArchiveHandler: TypeAlias = Callable[
    ["Session", zipfile.ZipFile, "ImportMetadata"], "list[SSEMessage] | None"
]

archive_handlers: list[ArchiveHandler] = []
