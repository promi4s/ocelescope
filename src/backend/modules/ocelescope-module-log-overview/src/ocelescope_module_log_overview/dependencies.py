from typing import Annotated

from fastapi import Depends
from ocelescope_backend.app.dependencies import ApiOcel

from ocelescope_module_log_overview.application.use_cases import (
    ComputeEventCategoricalUseCase,
    ComputeEventHistogramUseCase,
    ComputeEventKdeUseCase,
    ComputeEventViolinUseCase,
    ListEventAttributesUseCase,
)


def get_list_event_attributes_use_case(ocel: ApiOcel) -> ListEventAttributesUseCase:
    return ListEventAttributesUseCase(ocel)


def get_compute_event_histogram_use_case(ocel: ApiOcel) -> ComputeEventHistogramUseCase:
    return ComputeEventHistogramUseCase(ocel)


def get_compute_event_categorical_use_case(ocel: ApiOcel) -> ComputeEventCategoricalUseCase:
    return ComputeEventCategoricalUseCase(ocel)


def get_compute_event_kde_use_case(ocel: ApiOcel) -> ComputeEventKdeUseCase:
    return ComputeEventKdeUseCase(ocel)


def get_compute_event_violin_use_case(ocel: ApiOcel) -> ComputeEventViolinUseCase:
    return ComputeEventViolinUseCase(ocel)


ListEventAttributesDep = Annotated[
    ListEventAttributesUseCase, Depends(get_list_event_attributes_use_case)
]
ComputeEventHistogramDep = Annotated[
    ComputeEventHistogramUseCase, Depends(get_compute_event_histogram_use_case)
]
ComputeEventCategoricalDep = Annotated[
    ComputeEventCategoricalUseCase, Depends(get_compute_event_categorical_use_case)
]
ComputeEventKdeDep = Annotated[
    ComputeEventKdeUseCase, Depends(get_compute_event_kde_use_case)
]
ComputeEventViolinDep = Annotated[
    ComputeEventViolinUseCase, Depends(get_compute_event_violin_use_case)
]
