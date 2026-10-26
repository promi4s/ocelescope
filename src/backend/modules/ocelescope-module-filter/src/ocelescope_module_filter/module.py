from fastapi import FastAPI
from ocelescope_backend.app.modules import Module, ModuleMeta
from packaging.version import Version

from ocelescope_module_filter.preview.routes import router as preview_router
from ocelescope_module_filter.routes import router


class Filter(Module):
    meta = ModuleMeta(key="filter", version=Version("1.0"))

    def create_app(self) -> FastAPI:
        app = FastAPI(
            title="Filter",
            version=str(self.meta.version),
            docs_url=None,
            redoc_url=None,
        )

        app.include_router(router)
        app.include_router(preview_router)

        return app
