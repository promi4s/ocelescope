from pathlib import Path
from typing import Hashable, Self, Sequence, cast

import pandas as pd
from ocelescope.ocel.constants import ValueType
from ocelescope.ocel.extensions.base_extension import OCELExtension
from ocelescope.ocel.io import load_ocel_duckdb
from ocelescope.ocel.models.meta import OCELMeta
from pydantic.main import BaseModel

from ocelescope import (
    OCEL,
)
from ocelescope_backend.app.internal.ocel.filters import ModuleFilter, apply_filters
from ocelescope_backend.app.internal.ocel.lazy_ocel import LazyOCEL
from ocelescope_backend.app.internal.registry import registry_manager
from ocelescope_backend.app.internal.registry.extension import OCELExtensionDescription


class OcelMetadata(BaseModel):
    id: str
    name: str
    created_at: str
    extensions: list[OCELExtensionDescription]
    filter_applied: bool | None

    @classmethod
    def from_handle(cls, handle: "SessionOCEL", filter_applied: bool | None = None):
        descriptions = registry_manager.get_extension_descriptions()
        return cls(
            id=handle.id,
            created_at=handle.created_at,
            name=handle.name,
            extensions=[
                descriptions[extension.__class__.__name__]
                for extension in handle.extensions
                if extension.__class__.__name__ in descriptions
            ],
            filter_applied=filter_applied,
        )


class SessionOCEL:
    """A handle to an OCEL persisted as a DuckDB file on disk.

    The OCEL is never kept in memory. A global filter pipeline (:class:`ModuleFilter`
    s, grouped by the module that set them) defines a *view*; it is applied **once**
    -- when the pipeline changes -- into a pre-computed filtered DuckDB file. Both
    views then read that file: :meth:`ocel` materializes the pm4py :class:`OCEL`,
    :meth:`lazy` opens a RAM-friendly :class:`LazyOCEL`. So a per-request access
    never re-runs the filter. Passing ``use_original`` reads the origin instead.
    """

    def __init__(
        self,
        id: str,
        db_path: Path,
        name: str,
        created_at: str,
        extensions: list[OCELExtension] | None = None,
    ):
        self.id = id
        self.db_path = db_path
        self.name = name
        self.created_at = created_at
        self.extensions: list[OCELExtension] = extensions or []
        self._filters_by_source: dict[str, list[ModuleFilter]] = {}
        self._filtered_db_path: Path | None = None

    def _meta(self) -> OCELMeta:
        return OCELMeta(
            id=self.id, extra={"name": self.name, "upload_date": self.created_at}
        )

    def _all_filters(self) -> list[ModuleFilter]:
        return [f for pipeline in self._filters_by_source.values() for f in pipeline]

    def _active_path(self, use_original: bool) -> Path:
        """The DuckDB file to read: the origin, or the (once-computed) filtered one."""
        filters = self._all_filters()
        if use_original or not filters:
            return self.db_path
        if self._filtered_db_path is None:
            filtered = self.db_path.with_suffix(".filtered.duckdb")
            apply_filters(self.db_path, filtered, filters)
            self._filtered_db_path = filtered
        return self._filtered_db_path

    def ocel(self, use_original: bool = False) -> OCEL:
        """The materialized pm4py OCEL (filtered unless ``use_original``)."""
        ocel = load_ocel_duckdb(self._active_path(use_original), meta=self._meta())
        if self.extensions:
            ocel.extensions.set(self.extensions)
        return ocel

    def lazy(self, use_original: bool = False) -> LazyOCEL:
        """A RAM-friendly DuckDB reader (filtered unless ``use_original``)."""
        return LazyOCEL(self._active_path(use_original), meta=self._meta())

    def _drop_filtered(self) -> None:
        if self._filtered_db_path is not None:
            self._filtered_db_path.unlink(missing_ok=True)
            self._filtered_db_path = None

    @property
    def is_filtered(self) -> bool:
        return len(self._all_filters()) > 0

    def delete(self) -> None:
        self._drop_filtered()
        self.db_path.unlink(missing_ok=True)

    def get_filters(self, module_source: str | None = None) -> list[ModuleFilter]:
        if module_source is None:
            return self._all_filters()
        return list(self._filters_by_source.get(module_source, []))

    def set_filters(self, module_source: str, pipeline: Sequence[ModuleFilter]):
        self._filters_by_source[module_source] = list(pipeline)
        self._drop_filtered()
        if self._all_filters():
            self._active_path(use_original=False)


class Attribute(BaseModel):
    name: str
    min: str | int | float
    max: str | int | float
    distinct_values: int
    type: ValueType

    @classmethod
    def from_df_row(cls, row: tuple[Hashable, pd.Series]) -> Self:
        attribute_name = cast(str, row[0])
        series = row[1]

        return cls(
            name=attribute_name,
            min=series["min"],
            max=series["max"],
            distinct_values=series["distinct_values"],
            type=series["type"],
        )

    @classmethod
    def from_df(cls, df: pd.DataFrame) -> list[Self]:
        return [cls.from_df_row(row) for row in df.iterrows()]


class AggregatedAttribute(Attribute):
    entity_type_names: list[str]

    @classmethod
    def from_df_row(cls, row: tuple[Hashable, pd.Series]) -> Self:
        base = Attribute.from_df_row(row)

        return cls(
            entity_type_names=row[1]["object_types"] + row[1]["activities"],
            **base.model_dump(),
        )


class TypedAttribute(Attribute):
    entity_type: str

    @classmethod
    def from_df_row(cls, row: tuple[Hashable, pd.Series]) -> "TypedAttribute":
        index = cast(tuple[str, str], row[0])
        entity_type = index[0]
        base = Attribute.from_df_row((index[1], row[1]))

        return cls(
            entity_type=entity_type,
            **base.model_dump(),
        )


class QuantityInfo(BaseModel):
    item_types: list[str]
    total_object_count: int
    total_event_count: int
    object_types: list[str]
    activities: list[str]

    @classmethod
    def from_ocel(cls, ocel: OCEL) -> Self:
        return cls(
            item_types=ocel.quantities.item_types,
            total_object_count=len(ocel.quantities.objects),
            total_event_count=len(ocel.quantities.events),
            object_types=ocel.quantities.object_types,
            activities=ocel.quantities.activities,
        )
