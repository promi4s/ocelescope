from fastapi import FastAPI
from ocelescope_backend.app.modules import Module, ModuleMeta
from packaging.version import Version

from ocelescope_module_exploration.api.routes import router


class Exploration(Module):
    meta = ModuleMeta(key="exploration", version=Version("1.0"))

    @classmethod
    def create_app(cls) -> FastAPI:
        app = FastAPI(
            title="Exploration",
            version=str(cls.meta.version),
            docs_url=None,
            redoc_url=None,
        )

        app.include_router(router)

        return app
