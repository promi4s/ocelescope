from .annotations import annotations_router
from .ocels import ocels_router
from .plugins import plugin_router
from .resources import resource_router
from .session import session_router
from .tasks import tasks_router

routes = [
    session_router,
    ocels_router,
    tasks_router,
    plugin_router,
    resource_router,
    annotations_router,
]
__all__ = ["routes"]
