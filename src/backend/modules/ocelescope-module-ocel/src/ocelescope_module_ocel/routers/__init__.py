"""The OCEL module's router, assembled from the per-resource sub-routers.

``management`` is included first so its static single-segment paths (``/default``,
``/extension/meta``) are matched before the ``/{ocel_id}`` catch-all.
"""

from fastapi import APIRouter

from ocelescope_module_ocel.routers import (
    attributes,
    events,
    export,
    management,
    objects,
    quantities,
    relations,
)

router = APIRouter()
router.include_router(management.router)
router.include_router(attributes.router)
router.include_router(objects.router)
router.include_router(events.router)
router.include_router(relations.router)
router.include_router(quantities.router)
router.include_router(export.router)

__all__ = ["router"]
