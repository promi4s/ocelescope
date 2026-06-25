from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Optional

from fastapi import UploadFile

_CHUNK_SIZE = 1024 * 1024


async def spool_upload_to_tempfile(
    upload: UploadFile,
    *,
    suffix: Optional[str] = None,
    prefix: Optional[str] = "upload-",
) -> Path:
    """
    Stream an UploadFile to a temporary file using a bounded amount of memory.

    Unlike reading the whole file into a ``bytes``/``BytesIO`` object, this
    copies the upload in fixed-size chunks, so peak memory does not grow with
    the file size.

    The caller takes ownership of the returned path and is responsible for
    deleting it once it is no longer needed.

    Args:
        upload: The incoming FastAPI UploadFile.
        suffix: File suffix (e.g. '.sqlite', '.xmlocel').
        prefix: File prefix (e.g. 'upload-', 'tmp-', etc.)

    Returns:
        Path to the written temp file.
    """
    with NamedTemporaryFile(delete=False, suffix=suffix, prefix=prefix) as tmp:
        tmp_path = Path(tmp.name)
        while chunk := await upload.read(_CHUNK_SIZE):
            tmp.write(chunk)
    return tmp_path
