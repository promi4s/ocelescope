from __future__ import annotations

import warnings
from os import PathLike
from pathlib import Path
from typing import Any, Mapping, Sequence

import pandas as pd
import pm4py
import polars as pl
import r4pm
from pm4py.objects.ocel.obj import OCEL as PM4PYOCEL
from pm4py.objects.ocel.obj import deepcopy
from polars import DataFrame, LazyFrame

from ocelescope.ocel.constants.pm4py import O2O_SOURCE_ID, O2O_TARGET_ID
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
from ocelescope.ocel.util import clean_ocel
from ocelescope.ocel.util.io import pretty_print_json, pretty_print_xml
from ocelescope.ocel.util.xes import create_ocel_from_xml, write_ocel_to_xes


class OCEL:
    """
    High-level wrapper for an OCEL 2.0 event log.

    This class provides a structured access layer over a PM4PY OCEL instance.
    It exposes convenient managers for objects, events, E2O relations, O2O
    relations, and extensions. It also supports reading, writing, and
    filtering OCEL logs.

    Attributes:
        ocel (PM4PYOCEL):
            Computed property that rebuilds a PM4PY OCEL object from the
            current state of the managers (events, objects, relations) on
            each access.
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
        ocel: Mapping[str, DataFrame | LazyFrame],
        meta: OCELMeta | None = None,
        quantityExtension: tuple[
            DataFrame | LazyFrame | pd.DataFrame,
            DataFrame | LazyFrame | pd.DataFrame,
            DataFrame | LazyFrame | pd.DataFrame,
        ]
        | None = None,
    ):
        """
        Args:
            ocel: Mapping of table name ("events", "objects", "object_changes",
                "relations", "o2o") to its table. Each value may be an eager
                ``DataFrame`` (held in memory immediately) or a ``LazyFrame``
                (e.g. from :meth:`scan`), in which case the table is only read
                from disk the first time the corresponding manager is accessed.
            meta: Metadata for this OCEL instance.
            quantityExtension: Optional quantity extension tables.
        """
        self.meta = meta or OCELMeta()
        self.extensions = ExtensionManager(self)
        self.objects = ObjectsManager(
            self,
            objects_df=ocel.get("objects"),
            changes_df=ocel.get("object_changes"),
        )

        self.events = EventsManager(self, events_df=ocel.get("events"))
        self.e2o = E2OManager(self, e2o_df=ocel.get("relations"))
        self.o2o = O2OManager(self, o2o_df=ocel.get("o2o"))
        self.quantities = QuantityManager(self, quantityExtension)
        self.attributes = AttributeManager(self)
        self.executions = ExecutionsManager(self)

    @property
    def r4pm_dict(self) -> dict[str, pl.DataFrame]:
        """
        Assemble the current state of all managers into the dict-of-polars-DataFrames
        shape expected by r4pm (and accepted by the `OCEL` constructor).

        The O2O table is renamed back to PM4PY's raw column names
        ("ocel:oid", "ocel:oid_2"), the inverse of the rename `O2OManager`
        applies on construction.

        The managers expose their tables lazily (``.pl`` returns a ``LazyFrame``);
        r4pm and the export/copy paths need eager frames, so all five tables are
        materialized together in a single optimized ``collect_all`` pass here.

        Returns:
            dict[str, pl.DataFrame]: Keys "events", "objects", "object_changes",
            "relations", and "o2o".
        """
        events, objects, object_changes, relations, o2o = pl.collect_all(
            [
                self.events.pl,
                self.objects.pl,
                self.objects.changes_pl,
                self.e2o.pl,
                self.o2o.pl.rename(
                    {
                        O2O_SOURCE_ID: "ocel:oid",
                        O2O_TARGET_ID: "ocel:oid_2",
                    }
                ),
            ]
        )
        return {
            "events": events,
            "objects": objects,
            "object_changes": object_changes,
            "relations": relations,
            "o2o": o2o,
        }

    @property
    def ocel(self) -> PM4PYOCEL:
        """Rebuild a PM4PY OCEL object from `r4pm_dict`, reflecting the current state."""
        return r4pm.df.rs_ocel_to_pm4py(self.r4pm_dict)

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

        with warnings.catch_warnings(record=True):
            ocel_dict = clean_ocel(r4pm.df.import_ocel(str(path)))
            quantity_table = read_quantity_extension(path)
        return OCEL(
            ocel=ocel_dict, meta=OCELMeta(path=path, extra=meta), quantityExtension=quantity_table
        )

    # Filenames used by `scan`/`dump_arrow`, keyed by r4pm table name.
    _ARROW_FILES = {
        "events": "events.arrow",
        "objects": "objects.arrow",
        "object_changes": "object_changes.arrow",
        "relations": "relations.arrow",
        "o2o": "o2o.arrow",
    }

    # Filenames for the quantity-extension tables, keyed by `QuantityManager`
    # constructor order (oqty, qop, properties). Written/read all-or-nothing.
    _QUANTITY_ARROW_FILES = {
        "oqty": "oqty.arrow",
        "qop": "qop.arrow",
        "properties": "item_properties.arrow",
    }

    @staticmethod
    def scan(directory: str | Path, meta: dict[str, Any] = {}) -> OCEL:
        """
        Lazily open an OCEL from a directory of Arrow IPC files.

        Each core table is wrapped in a polars ``LazyFrame`` via ``scan_ipc``
        and is only read from disk the first time the corresponding manager is
        accessed (e.g. ``ocel.events.df``). Tables that are never touched are
        never loaded. Use this for server / long-lived contexts where holding
        every table in memory is wasteful.

        Files are expected to follow the layout written by :meth:`dump_arrow`
        (``events.arrow``, ``objects.arrow``, ``object_changes.arrow``,
        ``relations.arrow``, ``o2o.arrow``). Missing files yield empty tables.
        The quantity-extension tables (``oqty.arrow``, ``qop.arrow``,
        ``item_properties.arrow``) are scanned the same lazy way when present.

        Args:
            directory: Directory containing the Arrow IPC files.
            meta: Additional metadata to attach to the OCELMeta container.

        Returns:
            OCEL: A lazily-backed OCEL wrapper instance.
        """
        directory = Path(directory)
        lazy: dict[str, DataFrame | LazyFrame] = {
            key: pl.scan_ipc(directory / filename)
            for key, filename in OCEL._ARROW_FILES.items()
            if (directory / filename).exists()
        }

        quantity_lazy = {
            key: pl.scan_ipc(directory / filename)
            for key, filename in OCEL._QUANTITY_ARROW_FILES.items()
            if (directory / filename).exists()
        }
        quantity_extension = (
            (quantity_lazy["oqty"], quantity_lazy["qop"], quantity_lazy["properties"])
            if len(quantity_lazy) == len(OCEL._QUANTITY_ARROW_FILES)
            else None
        )

        return OCEL(
            ocel=lazy,
            meta=OCELMeta(path=directory, extra=meta),
            quantityExtension=quantity_extension,
        )

    def dump_arrow(self, directory: str | Path) -> None:
        """
        Write the OCEL's core tables to a directory as Arrow IPC files, in the
        layout consumed by :meth:`scan`.

        This materializes every core table once, so it is the counterpart to
        the lazy :meth:`scan`: dump an OCEL to disk here, then ``scan`` it back
        cheaply (per request) elsewhere. The O2O table is written with PM4PY's
        raw column names (via :attr:`r4pm_dict`), so the round-trip through
        ``scan`` reproduces the canonical names. The quantity extension is
        written too (when populated); other extensions are not included.

        Args:
            directory: Destination directory (created if missing).
        """
        directory = Path(directory)
        directory.mkdir(parents=True, exist_ok=True)
        tables = self.r4pm_dict
        for key, filename in OCEL._ARROW_FILES.items():
            tables[key].write_ipc(directory / filename)

        if self.quantities.is_populated():
            quantity_tables = {
                "oqty": self.quantities.oqty_pl,
                "qop": self.quantities.qop_pl,
                "properties": self.quantities.properties_pl,
            }
            for key, filename in OCEL._QUANTITY_ARROW_FILES.items():
                quantity_tables[key].collect().write_ipc(directory / filename)

    @staticmethod
    def import_to_arrow(source_path: str | Path, directory: str | Path) -> None:
        """Import an OCEL file straight to Arrow IPC files, without building managers.

        This is the cheap counterpart to ``OCEL.read(...).dump_arrow(...)``: it
        imports the source via r4pm, prunes dangling references with
        :func:`clean_ocel`, and writes the core tables to ``directory`` in the
        layout consumed by :meth:`scan` — never instantiating the manager layer
        or round-tripping through :attr:`r4pm_dict`.

        The quantity-extension tables are read and (when present) written
        alongside the core tables, so a subsequent :meth:`scan` of ``directory``
        recovers the full log lazily.

        Args:
            source_path: Path to the OCEL file (.jsonocel, .xmlocel, .sqlite).
            directory: Destination directory for the Arrow IPC files (created if
                missing).
        """
        from ocelescope.ocel.managers.quantities.quantity import (
            _OQTY_SCHEMA,
            _PROPERTIES_SCHEMA,
            _QOP_SCHEMA,
            _to_polars,
        )

        source_path = Path(source_path)
        directory = Path(directory)
        directory.mkdir(parents=True, exist_ok=True)

        with warnings.catch_warnings(record=True):
            tables = r4pm.df.import_ocel(str(source_path))
            oqty, qop, properties = read_quantity_extension(source_path)

        for key, filename in OCEL._ARROW_FILES.items():
            tables[key].write_ipc(directory / filename)

        # Normalize to typed polars frames (empty pandas would otherwise yield
        # null-typed columns) and write all three together so `scan` picks them up.
        if not (oqty.empty and qop.empty and properties.empty):
            quantity_tables = {
                "oqty": _to_polars(oqty, _OQTY_SCHEMA),
                "qop": _to_polars(qop, _QOP_SCHEMA),
                "properties": _to_polars(properties, _PROPERTIES_SCHEMA),
            }
            for key, filename in OCEL._QUANTITY_ARROW_FILES.items():
                frame = quantity_tables[key]
                eager = frame.collect() if isinstance(frame, LazyFrame) else frame
                eager.write_ipc(directory / filename)

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
                r4pm.df.export_ocel(self.r4pm_dict, str(xml_path))
                pretty_print_xml(xml_path)
            case ".jsonocel" | ".json":
                json_path = path.with_suffix(".json")
                r4pm.df.export_ocel(self.r4pm_dict, str(json_path))
                pretty_print_json(json_path)
            case ".sqlite":
                pm4py.write_ocel2_sqlite(self.ocel, str(path))
            case _:
                raise ValueError(f"Unsupported extension: {path.suffix}")

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
        return OCEL(ocel=create_ocel_from_xml(str(path), fallback_object_name))

    def __deepcopy__(self, memo: dict[int, Any]):
        ocel_dict = deepcopy(self.r4pm_dict, memo)
        ocel = OCEL(
            ocel=ocel_dict,
            meta=OCELMeta(extra=deepcopy(self.meta.extra, memo)),
            quantityExtension=(
                self.quantities.oqty_pl.collect(),
                self.quantities.qop_pl.collect(),
                self.quantities.properties_pl.collect(),
            )
            if self.quantities.is_populated()
            else None,
        )
        return ocel

    def __str__(self):
        return f"OCEL [{len(self.events.df)} events, {len(self.objects.df)} objects]"

    def __repr__(self):
        return str(self)
