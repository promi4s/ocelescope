"""Quantity-extension info."""

from __future__ import annotations

from fastapi import APIRouter
from ocelescope_backend.app.dependencies import ApiOcel

from ocelescope_module_ocel.models import QuantityInfo

router = APIRouter()


@router.get("/{ocel_id}/quantity/info", operation_id="QuantityInfo")
def get_quantity_info(ocel: ApiOcel) -> QuantityInfo:
    return QuantityInfo.from_ocel(ocel)
