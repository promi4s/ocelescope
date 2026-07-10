from typing import Annotated, Literal, cast

import pandas as pd
from pydantic import Field

from ocelescope.ocel.constants.pm4py import OID_COL
from ocelescope.ocel.filter.base import BaseFilter, FilterResult


class VariantFilter(BaseFilter):
    """Restrict the OCEL to the objects of ``object_type`` that follow any of ``variant_ids``.

    Variant membership is recomputed against the OCEL the filter is applied to,
    so it composes with other filters. Keeping the variants' objects retains
    every event those objects participate in, so flattening the result by
    ``object_type`` yields one trace per object, each following one of the given
    variants.
    """

    object_type: Annotated[str, Field(json_schema_extra={"fieldType": "object_type"})]
    variant_ids: list[str]
    mode: Literal["exclude", "include"] = "include"

    def filter(self, ocel):
        object_ids = ocel.executions.get_variant_object_ids(self.object_type, self.variant_ids)
        mask = cast(pd.Series, ocel.objects.df[OID_COL].isin(object_ids))
        if self.mode == "exclude":
            mask = ~mask
        return FilterResult(objects=mask)
