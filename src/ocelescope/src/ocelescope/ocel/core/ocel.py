from __future__ import annotations

import warnings
from pathlib import Path
from typing import Any

import pandas as pd
import pm4py
import r4pm
from pm4py.objects.ocel.obj import OCEL as PM4PYOCEL
from pm4py.objects.ocel.obj import deepcopy

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
from ocelescope.ocel.util.io import pretty_print_json, pretty_print_xml


class OCEL:
    """
    High-level wrapper for an OCEL 2.0 event log.

    This class provides a structured access layer over a PM4PY OCEL instance.
    It exposes convenient managers for objects, events, E2O relations, O2O
    relations, and extensions. It also supports reading, writing, and
    filtering OCEL logs.

    Attributes:
        ocel (PM4PYOCEL):
            The underlying PM4PY OCEL object containing the raw OCEL data
            (events, objects, relations).
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
        ocel: PM4PYOCEL,
        meta: OCELMeta | None = None,
        quantityExtension: tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame] | None = None,
    ):
        self.ocel = ocel
        self.meta = meta or OCELMeta()
        self.extensions = ExtensionManager(self)
        self.objects = ObjectsManager(self)
        self.events = EventsManager(self)
        self.quantities = QuantityManager(self, quantityExtension)
        self.e2o = E2OManager(self)
        self.o2o = O2OManager(self)
        self.attributes = AttributeManager(self)
        self.executions = ExecutionsManager(self)

    def filter(self, pipeline: list[BaseFilter]) -> OCEL:
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

        with warnings.catch_warnings(record=True):
            match path.suffix:
                case ".sqlite":
                    pm4py_ocel = pm4py.read.read_ocel2_sqlite(str(path))
                case ".xmlocel" | ".xml":
                    pm4py_ocel = r4pm.df.import_ocel_xml_pm4py(str(path))
                case ".jsonocel" | ".json":
                    pm4py_ocel = r4pm.df.import_ocel_json_pm4py(str(path))
                case _:
                    raise ValueError(f"Unsupported extension: {path.suffix}")

        quantity_table = read_quantity_extension(path)
        return OCEL(
            ocel=pm4py_ocel, meta=OCELMeta(path=path, extra=meta), quantityExtension=quantity_table
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

        match path.suffix:
            case ".xmlocel" | ".xml":
                xml_path = path.with_suffix(".xml")
                r4pm.df.export_ocel_pm4py(self.ocel, str(xml_path))
                pretty_print_xml(xml_path)
            case ".jsonocel" | ".json":
                json_path = path.with_suffix(".json")
                r4pm.df.export_ocel_pm4py(self.ocel, str(json_path))
                pretty_print_json(json_path)
            case ".sqlite":
                pm4py.write_ocel2_sqlite(self.ocel, str(path))
            case _:
                raise ValueError(f"Unsupported extension: {path.suffix}")

        self.quantities.write_quantities(path)
        self.extensions.export_all(path)

    def __deepcopy__(self, memo: dict[int, Any]):
        # TODO revisit this. Are the underlying DataFrames mutable? If not, might optimize this
        pm4py_ocel = deepcopy(self.ocel, memo)
        ocel = OCEL(
            ocel=pm4py_ocel,
            meta=OCELMeta(extra=deepcopy(self.meta.extra, memo)),
            quantityExtension=(
                self.quantities.oqty.copy(),
                self.quantities.qop.copy(),
                self.quantities.properties.copy(),
            )
            if self.quantities.is_populated()
            else None,
        )
        return ocel

    def __str__(self):
        return f"OCEL [{len(self.events.df)} events, {len(self.objects.df)} objects]"

    def __repr__(self):
        return str(self)
