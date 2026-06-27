import shutil
import tempfile
from pathlib import Path
from typing import Hashable, Self, Sequence, cast

import pandas as pd
from ocelescope.ocel.constants import ValueType
from ocelescope.ocel.extensions.base_extension import OCELExtension
from ocelescope.ocel.models.meta import OCELMeta
from pydantic.main import BaseModel

from ocelescope import (
    OCEL,
)
from ocelescope_backend.app.internal.registry import registry_manager
from ocelescope_backend.app.internal.registry.extension import OCELExtensionDescription
from ocelescope_backend.app.modules.base import ModuleFilter


class OcelMetadata(BaseModel):
    id: str
    name: str
    created_at: str
    extensions: list[OCELExtensionDescription]
    filter_applied: bool | None

    @classmethod
    def from_ocel(cls, ocel: OCEL, filter_applied: bool | None = None):
        extension_descriptions = registry_manager.get_extension_descriptions()

        return cls(
            id=ocel.meta.id,
            created_at=ocel.meta.extra["upload_date"],
            name=ocel.meta.extra["name"],
            extensions=[
                extension_descriptions[extension.__class__.__name__]
                for extension in ocel.extensions.all()
                if extension.__class__.__name__ in extension_descriptions
            ],
            filter_applied=filter_applied,
        )


class SessionOCEL:
    """Holds an OCEL for a session as a directory of Arrow IPC files rather than
    a fully-materialized ``OCEL`` object.

    The core tables and the quantity extension live on disk (a temp directory
    written by :meth:`OCEL.dump_arrow` / :meth:`OCEL.import_to_arrow`); the
    lazily-backed ``OCEL`` is rebuilt on each access via :meth:`OCEL.scan`, so
    the tables are only read from disk when actually touched. The OCEL is
    deliberately *not* cached: holding it for the session lifetime would also
    pin every derived result its managers' caches accumulate (attribute
    summaries, id→type maps, ...), which for a large log would defeat the
    point of the lazy layout. A fresh build is cheap (it only opens
    ``scan_ipc`` query plans), and within a single request the FastAPI
    dependency reuses one instance so the per-request caches still apply.

    Any loaded file extensions are kept in memory and re-attached to each built
    ``OCEL`` (they are not part of the Arrow layout).

    Filters are materialized once when set: the filtered log is dumped to its
    own Arrow directory, so reading the filtered OCEL just scans that directory
    instead of re-running the filter pipeline on every access.
    """

    def __init__(
        self,
        directory: str | Path,
        meta: OCELMeta,
        extensions: Sequence[OCELExtension] | None = None,
    ):
        self.directory = Path(directory)
        # `meta` is shared with every built OCEL so in-place edits (e.g. rename)
        # persist across rebuilds without a separate write-back.
        self.meta = meta
        self._extensions: list[OCELExtension] = list(extensions or [])

        self._applied_filter: list[ModuleFilter] = []
        self._filtered_directory: Path | None = None

    def _build(self, directory: Path, with_extensions: bool) -> OCEL:
        ocel = OCEL.scan(directory)
        ocel.meta = self.meta

        return ocel

    @property
    def origin(self) -> OCEL:
        return self._build(self.directory, with_extensions=True)

    @property
    def ocel(self) -> OCEL:
        if not self._applied_filter or self._filtered_directory is None:
            return self.origin
        return self._build(self._filtered_directory, with_extensions=False)

    def load_extensions(
        self, source_path: str | Path, extension_classes: list[type[OCELExtension]]
    ) -> None:
        """Load file extensions from ``source_path`` onto the origin OCEL.

        Extensions read their data from ``meta.path``; that is set temporarily
        for the load and the resulting instances are kept so they survive once
        the source file is gone.
        """
        ocel = self.origin
        self.meta.path = Path(source_path)
        try:
            ocel.extensions.load(extension_classes)
        finally:
            self.meta.path = None
        self._extensions = ocel.extensions.all()

    def get_filters(self, module_source: str | None) -> list[ModuleFilter]:
        return [
            filterItem
            for filterItem in self._applied_filter
            if module_source is None
            or filterItem.OcelescopeModuleSource == module_source
        ]

    def set_filters(self, module_source: str, pipeline: Sequence[ModuleFilter]):
        new_pipeline = [
            filter
            for filter in self._applied_filter
            if filter.OcelescopeModuleSource != module_source
        ] + [
            module_filter
            for module_filter in pipeline
            if module_filter.OcelescopeModuleSource == module_source
        ]

        self._clear_filtered()

        if new_pipeline:
            filtered = self.origin.filter(new_pipeline)
            directory = Path(tempfile.mkdtemp(prefix="ocel-filtered-"))
            filtered.dump_arrow(directory)
            self._filtered_directory = directory

        self._applied_filter = new_pipeline

    def _clear_filtered(self) -> None:
        if self._filtered_directory is not None:
            shutil.rmtree(self._filtered_directory, ignore_errors=True)
            self._filtered_directory = None

    def cleanup(self) -> None:
        """Remove the on-disk Arrow directories backing this OCEL."""
        self._clear_filtered()
        shutil.rmtree(self.directory, ignore_errors=True)


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
