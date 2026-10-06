from typing import ClassVar

from fastapi import FastAPI
from ocelescope_backend.app.modules import Module, ModuleMeta
from packaging.version import Version

from ocelescope import OCEL, QEL
from ocelescope_module_ocel.routers import router


class Ocel(Module):
    meta = ModuleMeta(key="ocel", version=Version("1.0"))
    extensions: ClassVar[list[type[OCEL]]] = [QEL]

    def create_app(self) -> FastAPI:
        app = FastAPI(
            title="OCEL", version=str(self.meta.version), docs_url=None, redoc_url=None
        )

        app.include_router(router)

        return app
