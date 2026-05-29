from typing import Annotated

from fastapi import Depends
from ocelescope_backend.app.dependencies import ApiOcel

from ocelescope_module_log_overview.application.use_cases import (
    ComputeEventHistogramUseCase,
    ListEventAttributesUseCase,
    ListEventInstancesUseCase,
)


def get_list_event_attributes_use_case(ocel: ApiOcel) -> ListEventAttributesUseCase:
    return ListEventAttributesUseCase(ocel)


def get_compute_event_histogram_use_case(
    ocel: ApiOcel,
) -> ComputeEventHistogramUseCase:
    return ComputeEventHistogramUseCase(ocel)


def get_list_event_instances_use_case(
    ocel: ApiOcel,
) -> ListEventInstancesUseCase:
    return ListEventInstancesUseCase(ocel)


ListEventAttributesDep = Annotated[
    ListEventAttributesUseCase, Depends(get_list_event_attributes_use_case)
]
ComputeEventHistogramDep = Annotated[
    ComputeEventHistogramUseCase, Depends(get_compute_event_histogram_use_case)
]
ListEventInstancesDep = Annotated[
    ListEventInstancesUseCase, Depends(get_list_event_instances_use_case)
]
