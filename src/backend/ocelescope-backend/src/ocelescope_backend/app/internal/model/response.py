from tempfile import NamedTemporaryFile

from fastapi.responses import FileResponse


class TempFileResponse(FileResponse):
    def __init__(
        self, prefix: str | None = None, suffix: str | None = None, **kwargs
    ) -> None:
        self.tmp_file = NamedTemporaryFile(prefix=prefix, suffix=suffix)
        super().__init__(
            path=self.tmp_file.name, **kwargs, media_type="application/octet-stream"
        )

    @property
    def tmp_path(self):
        return self.tmp_file.name

    def __del__(self):
        self.tmp_file.close()
