"""The filter payload this module pushes into the session.

The concrete filters live in :mod:`ocelescope_module_filter.filters` (built on the
backend's ``ModuleFilter`` contract). This assembles them into the discriminated
union the routes accept/return.
"""

from typing import Annotated, TypeAlias, Union

from pydantic import Field

from ocelescope_module_filter.filters import (
    ActivityFilter,
    E2OCountFilter,
    EventAttributeFilter,
    O2OCountFilter,
    ObjectAttributeFilter,
    ObjectTypeFilter,
    TimeFrameFilter,
)

FILTER_SOURCE = "FilterV1"

NativeFilter: TypeAlias = Annotated[
    Union[
        TimeFrameFilter,
        ActivityFilter,
        ObjectTypeFilter,
        EventAttributeFilter,
        ObjectAttributeFilter,
        E2OCountFilter,
        O2OCountFilter,
    ],
    Field(discriminator="type"),
]
