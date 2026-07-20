import os

os.environ.setdefault(
    "_RJEM_MALLOC_CONF", "dirty_decay_ms:0,muzzy_decay_ms:0,background_thread:true"
)

__all__: list[str] = []
