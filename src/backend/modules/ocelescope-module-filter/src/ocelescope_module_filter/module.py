from fastapi import FastAPI
from ocelescope_backend.app.modules import Module, ModuleMeta
from ocelescope_module_ocelot.routes import router
from packaging.version import Version


class Filter(Module):
    meta = ModuleMeta(key="filter", version=Version("1.0"))

    @classmethod
    def create_app(cls) -> FastAPI:
        app = FastAPI(
            title="Filter", version=str(cls.meta.version), docs_url=None, redoc_url=None
        )

        app.include_router(router)

        return app
