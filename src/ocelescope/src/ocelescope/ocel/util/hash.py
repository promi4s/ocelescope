import hashlib
import json


def hash_string_list(string_list: list[str]):
    payload = json.dumps(string_list, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
