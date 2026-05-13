from fastapi import FastAPI
from ocelescope_backend.app.modules import Module, ModuleMeta

from ocelescope_module_ocelot.routes import router


class TestModule(Module):
    meta = ModuleMeta(
        key="test-module",
        label="Test Module",
        version="0.1.0",
        mount_path="/test-module",
    )

    @classmethod
    def create_app(cls) -> FastAPI:
        app = FastAPI(
            title=cls.meta.label,
            version=cls.meta.version,
        )
        app.include_router(router)
        return app
