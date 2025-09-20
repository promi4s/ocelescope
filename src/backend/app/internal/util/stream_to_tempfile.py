from contextlib import contextmanager
from tempfile import NamedTemporaryFile
from pathlib import Path
import shutil
from typing import IO, Optional


@contextmanager
def stream_to_tempfile(
    stream: IO[bytes],
    *,
    suffix: Optional[str] = None,
    prefix: Optional[str] = "upload-",
):
    """
    Writes a file-like binary stream to a temporary file.

    Automatically deletes the file after the context block.

    Args:
        stream: File-like object with .read() method.
        suffix: File suffix (e.g. '.sqlite', '.xmlocel').
        prefix: File prefix (e.g. 'upload-', 'tmp-', etc.)

    Yields:
        Path to the written temp file.
    """
    tmp_path = None
    try:
        with NamedTemporaryFile(delete=False, suffix=suffix, prefix=prefix) as tmp:
            tmp_path = Path(tmp.name)
            shutil.copyfileobj(stream, tmp)
        yield tmp_path
    finally:
        if tmp_path and tmp_path.exists():
            try:
                tmp_path.unlink()
            except Exception:
                pass
