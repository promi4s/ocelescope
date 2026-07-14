"""Quantity-extension info (lazy polars over OCELDb)."""

from __future__ import annotations

from fastapi import APIRouter
from ocelescope_backend.app.dependencies import ApiOCELDb

from ocelescope_module_ocel.models import QuantityInfo
from ocelescope_module_ocel.util import quantities as quantity_util

router = APIRouter()


@router.get("/{ocel_id}/quantity/info", operation_id="QuantityInfo")
def get_quantity_info(ocel_db: ApiOCELDb) -> QuantityInfo:
    return quantity_util.quantity_info(ocel_db)
