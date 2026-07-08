from __future__ import annotations

import warnings
from os import PathLike
from pathlib import Path
from typing import Any, Sequence

import pandas as pd
import pm4py
import polars as pl
import r4pm
from pm4py.objects.ocel.obj import OCEL as PM4PYOCEL

from ocelescope.ocel.constants.pm4py import (
    O2O_QUALIFIER,
    O2O_TARGET_ID,
    OBJECT_CHANGES_DF_COLS,
    OID_COL,
)
from ocelescope.ocel.extensions.manager import ExtensionManager
from ocelescope.ocel.filter.base import BaseFilter
from ocelescope.ocel.managers import (
    E2OManager,
    EventsManager,
    O2OManager,
    ObjectsManager,
    QuantityManager,
)
from ocelescope.ocel.managers.attributes import AttributeManager
from ocelescope.ocel.managers.executions import ExecutionsManager
from ocelescope.ocel.managers.quantities.util.io import read_quantity_extension
from ocelescope.ocel.models.meta import OCELMeta
from ocelescope.ocel.util.xes import create_ocel_from_xml, write_ocel_to_xes


class OCEL:
    """
    High-level wrapper for an OCEL 2.0 event log.

    The source of truth for this class is a small set of pandas DataFrames
    (events, objects, E2O relations, O2O relations and object changes). A PM4PY
    OCEL is not stored; it is built lazily from those DataFrames on demand via
    the :attr:`ocel` property, so callers that only read tables never pay for
    constructing a PM4PY object.

    It exposes convenient managers for objects, events, E2O relations, O2O
    relations, and extensions. It also supports reading, writing, and
    filtering OCEL logs.

    Attributes:
        meta (OCELMeta):
            Metadata associated with this OCEL instance, including file path,
            unique ID, and any additional user-defined information.
        extensions (ExtensionManager):
            Manages all loaded OCEL extensions and handles exporting of
            extension data.
        objects (ObjectsManager):
            Provides structured access to all object-related information such
            as types, attributes, and object tables.
        events (EventsManager):
            Provides structured access to event-level information such as
            activities, event attributes, and event tables.
        e2o (E2OManager):
            Manages event-to-object relations, including typed relations and
            qualifier-based summaries.
        o2o (O2OManager):
            Manages object-to-object relations, providing typed lookups and
            relation-count summaries.
    """

    def __init__(
        self,
        events: pd.DataFrame,
        objects: pd.DataFrame,
        relations: pd.DataFrame,
        o2o: pd.DataFrame | None = None,
        object_changes: pd.DataFrame | None = None,
        meta: OCELMeta | None = None,
        quantityExtension: tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame] | None = None,
    ):
        """
        Args:
            events: Event table (source of truth), PM4PY column naming.
            objects: Object table (source of truth), PM4PY column naming.
            relations: E2O relation table (source of truth), PM4PY column naming.
            o2o: Optional O2O relation table. Defaults to an empty table.
            object_changes: Optional dynamic object-attribute change table.
                Defaults to an empty table.
            meta: Metadata for this OCEL instance.
            quantityExtension: Optional quantity-extension tables.
        """
        self._events = events
        self._objects = objects
        self._relations = relations
        self._o2o = (
            o2o
            if o2o is not None
            else pd.DataFrame(columns=[OID_COL, O2O_TARGET_ID, O2O_QUALIFIER])
        )
        self._object_changes = (
            object_changes
            if object_changes is not None
            else pd.DataFrame(columns=OBJECT_CHANGES_DF_COLS)
        )

        self.meta = meta or OCELMeta()
        self.extensions = ExtensionManager(self)
        self.objects = ObjectsManager(self)
        self.events = EventsManager(self)
        self.quantities = QuantityManager(self, quantityExtension)
        self.e2o = E2OManager(self)
        self.o2o = O2OManager(self)
        self.attributes = AttributeManager(self)
        self.executions = ExecutionsManager(self)

    # ------------------------------------------------------------------
    # PM4PY interop
    # ------------------------------------------------------------------
    @property
    def ocel(self) -> PM4PYOCEL:
        """
        Return a fresh PM4PY OCEL built from the underlying DataFrames.

        A new PM4PY object is constructed on every access. It is only needed for
        operations that rely on PM4PY (filtering, flattening, writing), so plain
        table reads via the managers never build one.
        """
        return PM4PYOCEL(
            events=self._events,
            objects=self._objects,
            relations=self._relations,
            o2o=self._o2o,
            object_changes=self._object_changes,
        )

    def _as_polars_tables(self) -> dict[str, pl.DataFrame]:
        """Return the underlying tables as polars DataFrames for r4pm export.

        Internal ``@@``-prefixed columns (e.g. PM4PY's ``@@cumcount``) are
        dropped so they don't leak into the exported file as attributes.
        """

        def to_polars(df: pd.DataFrame) -> pl.DataFrame:
            internal = [col for col in df.columns if col.startswith("@@")]
            return pl.from_pandas(df.drop(columns=internal) if internal else df)

        return {
            "events": to_polars(self._events),
            "objects": to_polars(self._objects),
            "relations": to_polars(self._relations),
            "o2o": to_polars(self._o2o),
            "object_changes": to_polars(self._object_changes),
        }

    @classmethod
    def from_pm4py(
        cls,
        ocel: PM4PYOCEL,
        meta: OCELMeta | None = None,
        quantityExtension: tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame] | None = None,
    ) -> OCEL:
        """
        Build an :class:`OCEL` from an existing PM4PY OCEL by extracting its
        DataFrames as the source of truth.
        """
        return cls(
            events=ocel.events,
            objects=ocel.objects,
            relations=ocel.relations,
            o2o=ocel.o2o,
            object_changes=ocel.object_changes,
            meta=meta,
            quantityExtension=quantityExtension,
        )

    def filter(self, pipeline: Sequence[BaseFilter]) -> OCEL:
        """
        Apply a sequence of filters to this OCEL instance.

        Filters are executed in sequence, and their boolean masks are merged
        to produce a refined subset of events and objects. A new OCEL instance
        is returned containing only the items that satisfy all filters.

        Args:
            pipeline (list[BaseFilter]):
                A list of filter objects, each implementing a ``filter()`` method
                that returns a ``FilterResult`` mask.

        Returns:
            OCEL: A new OCEL instance representing the filtered view of the log.
        """
        from ocelescope.ocel.filter.engine import apply_filters

        return apply_filters(ocel=self, filters=pipeline)

    @staticmethod
    def read(path: str | Path, meta: dict[str, Any] = {}) -> OCEL:
        """
        Read an OCEL file (.jsonocel, .xmlocel, or .sqlite) from disk.

        Automatically detects the file format based on extension and loads the
        OCEL into a structured wrapper.

        Args:
            path (str | Path):
                Path to the OCEL file on disk.
            meta (dict[str, Any], optional):
                Additional metadata to attach to the OCELMeta container.

        Returns:
            OCEL: A fully constructed OCEL wrapper instance.
        """

        path = Path(path)

        quantity_table = read_quantity_extension(path)
        ocel_meta = OCELMeta(path=path, extra=meta)

        with warnings.catch_warnings(record=True):
            match path.suffix:
                case ".sqlite":
                    # r4pm's sqlite reader is unreliable, so use pm4py here.
                    return OCEL.from_pm4py(
                        pm4py.read.read_ocel2_sqlite(str(path)),
                        meta=ocel_meta,
                        quantityExtension=quantity_table,
                    )
                case ".xmlocel" | ".xml":
                    tables = r4pm.df.import_ocel_xml(str(path))
                case ".jsonocel" | ".json":
                    tables = r4pm.df.import_ocel_json(str(path))
                case _:
                    raise ValueError(f"Unsupported extension: {path.suffix}")

        return OCEL(
            events=tables["events"].to_pandas(),
            objects=tables["objects"].to_pandas(),
            relations=tables["relations"].to_pandas(),
            o2o=tables["o2o"].to_pandas() if "o2o" in tables else None,
            object_changes=(
                tables["object_changes"].to_pandas() if "object_changes" in tables else None
            ),
            meta=ocel_meta,
            quantityExtension=quantity_table,
        )

    def write(self, path: str | Path):
        """
        Write the OCEL log and all registered extensions to disk.

        The output format is inferred from the file extension. Supported file
        types are:
            - .jsonocel
            - .xmlocel
            - .sqlite

        Args:
            path (str | Path):
                Destination file path.

        Raises:
            ValueError: If the file extension is not supported.
        """
        path = Path(path)

        if path.suffix not in {".xmlocel", ".xml", ".jsonocel", ".json", ".sqlite"}:
            raise ValueError(f"Unsupported extension: {path.suffix}")

        r4pm.df.export_ocel(self._as_polars_tables(), str(path))

        self.quantities.write_quantities(path)
        self.extensions.export_all(path)

    def write_xes(self, object_type: str, path: str | Path):
        """
        Export the OCEL as a flattened XES log for a given object type.

        Args:
            object_type: Object type to flatten the OCEL to.
            path: Output file path for the XES file.

        Returns:
            None
        """

        write_ocel_to_xes(ocel=self, object_type=object_type, path=path)

    @staticmethod
    def read_xes(path: str | PathLike, fallback_object_name: str = "LogObject") -> OCEL:
        return OCEL.from_pm4py(create_ocel_from_xml(str(path), fallback_object_name))

    def __deepcopy__(self, memo: dict[int, Any]):
        from copy import deepcopy

        return OCEL(
            events=self._events.copy(deep=True),
            objects=self._objects.copy(deep=True),
            relations=self._relations.copy(deep=True),
            o2o=self._o2o.copy(deep=True),
            object_changes=self._object_changes.copy(deep=True),
            meta=OCELMeta(extra=deepcopy(self.meta.extra, memo)),
            quantityExtension=(
                self.quantities.oqty.copy(),
                self.quantities.qop.copy(),
                self.quantities.properties.copy(),
            )
            if self.quantities.is_populated()
            else None,
        )

    def __str__(self):
        return f"OCEL [{len(self.events.df)} events, {len(self.objects.df)} objects]"

    def __repr__(self):
        return str(self)
