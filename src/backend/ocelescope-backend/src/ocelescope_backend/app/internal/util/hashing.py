import dataclasses
import hashlib
from typing import Any

import orjson
from pydantic import BaseModel


def normalize(obj: Any) -> Any:
    """Recursively convert objects into JSON-serializable, deterministic forms."""
    if isinstance(obj, BaseModel):
        return normalize(obj.model_dump())

    if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
        return normalize(dataclasses.asdict(obj))

    if isinstance(obj, dict):
        return {str(k): normalize(v) for k, v in sorted(obj.items())}

    if isinstance(obj, (list, tuple)):
        return [normalize(v) for v in obj]

    if isinstance(obj, set):
        return sorted(normalize(v) for v in obj)

    return obj


def to_canonical_bytes(obj: Any) -> bytes:
    """Serialize normalized object to canonical JSON bytes."""
    normalized = normalize(obj)
    return orjson.dumps(normalized, option=orjson.OPT_SORT_KEYS)


def generate_tuple_hash(*args: Any) -> str:
    """Generate a deterministic SHA-256 hash for arbitrary arguments."""
    h = hashlib.sha256()
    for arg in args:
        h.update(to_canonical_bytes(arg))
        h.update(b"\x00")
    return h.hexdigest()
