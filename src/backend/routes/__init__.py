from .session import session_router
from .ocels import ocels_router
from .tasks import tasks_router
from .plugins import plugin_router

routes = [session_router, ocels_router, tasks_router, plugin_router]
__all__ = ["routes"]
