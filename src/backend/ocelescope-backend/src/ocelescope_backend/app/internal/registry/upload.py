from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING, TypeAlias

if TYPE_CHECKING:
    from ocelescope_backend.app.sse_manager import SSEMessage

UploadClaimer: TypeAlias = Callable[[Path, str], "list[SSEMessage] | None"]

upload_claimers: list[UploadClaimer] = []
