from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ocelescope.util.pydantic import uuid_factory


@dataclass
class OCELMeta:
    """Metadata for an OCEL instance.

    Attributes:
        id: Unique identifier for this metadata/log instance.
        path: Filesystem path from which this OCEL was loaded.
        extra: Free-form metadata for user-defined fields.
    """

    id: str = field(default_factory=uuid_factory)
    path: Path | None = None
    extra: dict[str, Any] = field(default_factory=dict)
