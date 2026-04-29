import pandas as pd

from ocelescope.ocel.constants.executions import (
    EXECUTION_ACT_LIST_COL,
    EXECUTION_EID_LIST_COL,
    EXECUTION_OTYPE_COL,
    EXECUTION_TSTAMP_LIST_COL,
    EXECUTION_VARIANT_ID_COL,
    VARIANT_ACT_LIST_COL,
    VARIANT_FREQUENCY_COL,
    VARIANT_OTYPE_COL,
)
from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, EID_COL, OID_COL, OTYPE_COL, TIMESTAMP_COL
from ocelescope.ocel.managers.base import BaseManager
from ocelescope.ocel.util.hash import hash_string_list


class ExecutionsManager(BaseManager):
    """
    Manages object-to-object (O2O) relations within an OCEL instance.

    Provides:
        - Access to the raw O2O relation table
        - A normalized O2O table using canonical constant column names
        - Type-enriched O2O relations (joining object types)
        - Aggregated summaries of O2O relation multiplicities

    This manager acts as a typed and normalized facade over the
    PM4PY O2O relation table.
    """

    def get_object_executions(
        self,
        object_types: list[str] | None = None,
        include_timestamps: bool = False,
        include_eid: bool = False,
    ) -> pd.DataFrame:
        e2o = self._ocel.e2o.df.sort_values(by=[OID_COL, TIMESTAMP_COL])

        if object_types is not None:
            e2o = e2o.loc[e2o[OTYPE_COL].isin(object_types)]

        executions = e2o.groupby(by=OID_COL).agg(
            **{
                EXECUTION_OTYPE_COL: (OTYPE_COL, "first"),
                EXECUTION_ACT_LIST_COL: (ACTIVITY_COL, list),
            },
            **(
                {
                    EXECUTION_TSTAMP_LIST_COL: (TIMESTAMP_COL, list),
                }
                if include_timestamps
                else {}
            ),
            **(
                {
                    EXECUTION_EID_LIST_COL: (EID_COL, list),
                }
                if include_eid
                else {}
            ),
        )

        executions[EXECUTION_VARIANT_ID_COL] = (
            executions[EXECUTION_OTYPE_COL]
            + "_"
            + executions[EXECUTION_ACT_LIST_COL].apply(hash_string_list)
        )

        return executions

    def get_object_variants(self, object_types: list[str] | None = None) -> pd.DataFrame:
        executions = self.get_object_executions(object_types)

        variants = (
            executions.groupby(by=[EXECUTION_VARIANT_ID_COL])
            .agg(
                **{
                    VARIANT_OTYPE_COL: (EXECUTION_OTYPE_COL, "first"),
                    VARIANT_ACT_LIST_COL: (EXECUTION_ACT_LIST_COL, "first"),
                    VARIANT_FREQUENCY_COL: (EXECUTION_OTYPE_COL, "size"),
                }
            )
            .sort_values(by=[VARIANT_OTYPE_COL, VARIANT_FREQUENCY_COL], ascending=False)
        )

        return variants
