from .plugins import plugin_router
from .resources import resource_router
from .session import session_router
from .tasks import tasks_router

routes = [
    session_router,
    tasks_router,
    plugin_router,
    resource_router,
]
__all__ = ["routes"]
