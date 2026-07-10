import hashlib
import json
from collections.abc import Iterable


def hash_string_list(string_list: Iterable[str]):
    payload = json.dumps(
        [str(value) for value in string_list],
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
