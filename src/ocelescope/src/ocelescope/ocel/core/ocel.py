from __future__ import annotations

from os import PathLike
from pathlib import Path
from typing import Literal, Sequence

import duckdb
import pandas as pd
import polars as pl
import r4pm
from pm4py.objects.ocel.obj import OCEL as PM4PYOCEL

from ocelescope.ocel.constants.pm4py import (
    EID_COL,
    O2O_QUALIFIER,
    O2O_SOURCE_ID,
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
from ocelescope.ocel.managers.executions import ExecutionsManager
from ocelescope.ocel.util.xes import create_ocel_from_xml, write_ocel_to_xes
from ocelescope.util.sql import set_utc

#: Name the destination database is attached under while :meth:`OCEL.to_duckdb` copies.
_COPY_TARGET = "_copy_target"

#: A table :meth:`OCEL.from_frames` accepts. DuckDB scans each of them directly.
Frame = pd.DataFrame | pl.DataFrame | pl.LazyFrame

#: PM4PY calls an O2O relation's source object ``ocel:oid`` and its target
#: ``ocel:oid_2``; we call them ``ocel:oid_1`` / ``ocel:oid_2``. That one column is
#: the only place the two namings disagree, so it is the only thing to translate --
#: and it is translated here, at the PM4PY boundary, rather than by the O2O manager.
_O2O_TO_PM4PY = {O2O_SOURCE_ID: OID_COL}
_O2O_FROM_PM4PY = {OID_COL: O2O_SOURCE_ID}

#: Extensions r4pm can read. It has no usable SQLite reader (see :meth:`OCEL.read`).
_R4PM_SUFFIXES = {".jsonocel", ".json", ".xmlocel", ".xml"}


class OCEL:
    """
    High-level wrapper for an OCEL 2.0 event log.

    An OCEL is a **DuckDB connection** holding the flat OCEL tables (``events``,
    ``objects``, ``e2o``, ``o2o``, ``object_changes``, plus the optional quantity
    tables). That database is the single source of truth, and each manager reaches
    its own table on it: ``.table`` is a lazy DuckDB relation, ``.pl`` a polars
    LazyFrame and ``.df`` a pandas frame -- the first two lazy, the last read on
    access -- and each is assignable to write the table back. Reading only the
    events therefore never materializes the rest of the log.

    Construct one with :meth:`read` (from an OCEL file), :meth:`from_duckdb` (from
    an existing database) or :meth:`from_frames` / :meth:`from_pm4py` (from tables
    already in memory, which are written into a fresh in-memory database).

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
        connection: duckdb.DuckDBPyConnection,
    ):
        """
        Args:
            connection: An open DuckDB connection holding the flat OCEL tables,
                with its ``TimeZone`` set to UTC. The OCEL takes ownership of it:
                for an in-memory database, which DuckDB drops once its last
                connection closes, that means the log lives exactly as long as
                this instance.
            meta: Metadata for this OCEL instance.
        """
        self._con = connection

        self.extensions = ExtensionManager(self)
        self.objects = ObjectsManager(self)
        self.events = EventsManager(self)
        self.quantities = QuantityManager(self)
        self.e2o = E2OManager(self)
        self.o2o = O2OManager(self)
        self.executions = ExecutionsManager(self)

    # ------------------------------------------------------------------
    # Database access
    # ------------------------------------------------------------------
    @property
    def con(self) -> duckdb.DuckDBPyConnection:
        """The DuckDB connection backing this OCEL."""
        return self._con

    def sql(self, query: str, params: list[object] | None = None) -> duckdb.DuckDBPyRelation:
        """Run a read query over the stored tables, returning a lazy relation.

        The escape hatch for reads the managers cannot express -- multi-table joins,
        list aggregation, window functions. Reference the stored tables by name
        (``events``, ``objects``, ``e2o``, ``o2o``, ``object_changes``, and the
        quantity tables when present); note those are the *stored* shapes, not the
        reshaped ones the managers hand out.

        The query runs on its own cursor, so its result can be combined with a
        manager's table in a single follow-up query.

        Bind caller-supplied values through ``params`` (``?`` placeholders) rather
        than formatting them into ``query``, so they stay injection-safe.
        """
        cursor = self._con.cursor()
        set_utc(cursor)
        return cursor.sql(query, params=params) if params else cursor.sql(query)

    def clean(self) -> None:
        """Drop everything the log no longer supports, in place.

        An OCEL stops being a valid log as soon as something is removed from it: a
        relation can be left pointing at an event or object that is gone, and an
        entity can be left in no relation at all. This puts that right --

        * a relation whose event or object is missing is dropped,
        * an object in no relation, E2O or O2O, is dropped,
        * an event with no E2O relation is dropped,
        * object changes follow their object.

        Order matters: relations are pruned first, so the orphan checks that follow
        read a relation table that is already true. Quantities are left alone.

        Removing rows yourself (``ocel.events.df = ...``) leaves the log in exactly
        that state, so this is what makes it whole again -- :meth:`filter` runs it
        for you.
        """
        con = self._con
        con.execute(
            f'DELETE FROM e2o WHERE "{EID_COL}" NOT IN (SELECT "{EID_COL}" FROM events) '
            f'OR "{OID_COL}" NOT IN (SELECT "{OID_COL}" FROM objects)'
        )
        con.execute(
            f'DELETE FROM o2o WHERE "{O2O_SOURCE_ID}" NOT IN (SELECT "{OID_COL}" FROM objects) '
            f'OR "{O2O_TARGET_ID}" NOT IN (SELECT "{OID_COL}" FROM objects)'
        )
        con.execute(
            f'DELETE FROM objects WHERE "{OID_COL}" NOT IN (SELECT "{OID_COL}" FROM e2o) '
            f'AND "{OID_COL}" NOT IN (SELECT "{O2O_SOURCE_ID}" FROM o2o) '
            f'AND "{OID_COL}" NOT IN (SELECT "{O2O_TARGET_ID}" FROM o2o)'
        )
        con.execute(f'DELETE FROM events WHERE "{EID_COL}" NOT IN (SELECT "{EID_COL}" FROM e2o)')
        con.execute(
            f'DELETE FROM object_changes WHERE "{OID_COL}" NOT IN (SELECT "{OID_COL}" FROM objects)'
        )

    def close(self) -> None:
        """Close the underlying connection, dropping an in-memory database."""
        self._con.close()

    def __enter__(self) -> OCEL:
        return self

    def __exit__(self, *_exc) -> None:
        self.close()

    # ------------------------------------------------------------------
    # Construction
    # ------------------------------------------------------------------
    @classmethod
    def from_duckdb(cls, connection: duckdb.DuckDBPyConnection) -> OCEL:
        """Build an :class:`OCEL` on an existing DuckDB connection.

        An alias of the constructor that names what it does at the call site.
        """
        return cls(connection)

    @classmethod
    def from_frames(
        cls,
        events: Frame,
        objects: Frame,
        relations: Frame,
        o2o: Frame | None = None,
        object_changes: Frame | None = None,
        quantityExtension: tuple[Frame, Frame, Frame] | None = None,
    ) -> OCEL:
        """
        Build an :class:`OCEL` from tables already held in memory.

        The frames are written into a fresh in-memory DuckDB database, which then
        backs the returned OCEL like any other. This is the way in for callers
        that produced their tables themselves rather than reading a file.

        Every table may be a pandas frame, a polars frame or a LazyFrame -- DuckDB
        reads them all directly, so none is converted on the way in.

        Tables are in the same shape the managers hand them out, so a table taken
        off one OCEL can be given to another. That is PM4PY's naming too, save for
        the O2O source column: see :meth:`from_pm4py`, which translates it.

        Args:
            events: Event table, as :attr:`EventsManager.df`.
            objects: Object table, as :attr:`ObjectsManager.df`.
            relations: E2O relation table, as :attr:`E2OManager.df`.
            o2o: Optional O2O relation table, as :attr:`O2OManager.df` -- the source
                object named ``ocel:oid_1``. Defaults to an empty table.
            object_changes: Optional dynamic object-attribute change table, as
                :attr:`ObjectsManager.changes`. Defaults to an empty table.
            meta: Metadata for this OCEL instance.
            quantityExtension: Optional quantity-extension tables.
        """
        connection = duckdb.connect(":memory:")
        try:
            set_utc(connection)
            ocel = cls(connection)
            # Each table goes in through its manager, which projects it back onto
            # the stored layout. Objects first: the object changes are stored with
            # one column per object attribute, so that table has to exist already.
            ocel.objects.table = objects
            ocel.events.table = events
            ocel.e2o.table = relations
            ocel.o2o.table = (
                o2o
                if o2o is not None
                else pd.DataFrame(columns=[O2O_SOURCE_ID, O2O_TARGET_ID, O2O_QUALIFIER])
            )
            ocel.objects.changes_table = (
                object_changes
                if object_changes is not None
                else pd.DataFrame(columns=OBJECT_CHANGES_DF_COLS)
            )
            if quantityExtension is not None:
                oqty, qop, properties = quantityExtension
                ocel.quantities.oqty = oqty
                ocel.quantities.qop = qop
                ocel.quantities.properties = properties
        except Exception:
            connection.close()
            raise

        return ocel

    @classmethod
    def from_pm4py(
        cls,
        ocel: PM4PYOCEL,
    ) -> OCEL:
        """
        Build an :class:`OCEL` from an existing PM4PY OCEL by writing its
        DataFrames into a fresh in-memory database.

        PM4PY's naming is ours but for the O2O source column, and this is the
        boundary it arrives at, so that is renamed here.
        """
        return cls.from_frames(
            events=ocel.events,
            objects=ocel.objects,
            relations=ocel.relations,
            o2o=ocel.o2o.rename(columns=_O2O_FROM_PM4PY),
            object_changes=ocel.object_changes,
        )

    @staticmethod
    def read(
        path: str | Path,
        variant: Literal["r4pm", "streamed"] = "r4pm",
    ) -> OCEL:
        """
        Read an OCEL file (.jsonocel, .xmlocel, or .sqlite) from disk.

        Either way the log ends up in an in-memory DuckDB database, which becomes
        the returned OCEL's source of truth; the pandas tables are reshaped out of
        it only as they are asked for. The format is detected from the extension.

        Args:
            path (str | Path):
                Path to the OCEL file on disk.
            meta (dict[str, Any], optional):
                Additional metadata to attach to the OCELMeta container.
            variant:
                Which reader to use.

                ``"r4pm"`` parses the whole log with r4pm's Rust reader and hands
                the finished tables over, which is fast but holds the log in
                memory while it does so.

                ``"streamed"`` reads the file entity by entity into the database,
                so peak memory stays bounded by the log's widest single entity
                rather than the whole log -- use it for logs too big to hold.

                **``.sqlite`` logs are always streamed.** r4pm has no SQLite
                reader worth the name: it assumes every object-type table carries
                an ``ocel_changed_field`` column and errors out on the many real
                logs that don't.

        Returns:
            OCEL: A fully constructed OCEL wrapper instance.
        """
        from ocelescope.ocel.io import convert_ocel_duckdb
        from ocelescope.ocel.io.importers.quantities import import_quantities

        path = Path(path)

        if variant == "r4pm" and path.suffix in _R4PM_SUFFIXES:
            tables = r4pm.df.import_ocel(str(path))
            # r4pm hands back PM4PY-named tables, so the O2O source column is
            # renamed on the way in -- exactly as in :meth:`from_pm4py`.
            o2o = tables.get("o2o")
            ocel = OCEL.from_frames(
                events=tables["events"],
                objects=tables["objects"],
                relations=tables["relations"],
                o2o=o2o.rename(_O2O_FROM_PM4PY) if o2o is not None else None,
                object_changes=tables.get("object_changes"),
            )
            try:
                import_quantities(path, ocel.con)
            except Exception:
                ocel.close()
                raise
            return ocel

        connection = duckdb.connect(":memory:")
        try:
            convert_ocel_duckdb(path, connection)
            set_utc(connection)
        except Exception:
            connection.close()
            raise

        return OCEL(
            connection,
        )

    @staticmethod
    def read_duckdb(
        db_path: str | Path,
    ) -> OCEL:
        """
        Open a flat DuckDB database (as written by :meth:`to_duckdb` or
        ``convert_ocel_duckdb``) as an :class:`OCEL`.

        The database is opened read-only and no log data is read here -- the
        tables are reshaped out of the file only as they are asked for. The OCEL
        reads through to ``db_path`` for as long as it lives, so the file must
        outlive it, and its tables cannot be assigned to.

        Args:
            db_path: Path to a DuckDB database holding the flat OCEL tables.
            meta: Metadata for this OCEL instance.
        """
        connection = duckdb.connect(str(db_path), read_only=True)
        try:
            # DuckDB hands back TIMESTAMPTZ values in the session's zone; pin it to
            # UTC so the reshaped tables match a normal file read.
            set_utc(connection)
        except Exception:
            connection.close()
            raise

        return OCEL(connection)

    def to_duckdb(self, db_path: str | Path) -> None:
        """
        Write this OCEL's database out to a DuckDB file at ``db_path``.

        DuckDB copies the database wholesale -- every table, quantity tables
        included -- so nothing is reshaped through pandas on the way.

        Args:
            db_path: Destination path. An existing file is replaced.
        """
        db_path = Path(db_path)
        db_path.unlink(missing_ok=True)

        # An in-memory database is called "memory", a file-backed one after its
        # file, so ask rather than assume. (fetchall, because fetchone is typed
        # optional -- a scalar SELECT always has its row.)
        source = self._con.execute("SELECT current_database()").fetchall()[0][0]

        self._con.execute(f"ATTACH '{db_path}' AS {_COPY_TARGET}")
        try:
            self._con.execute(f'COPY FROM DATABASE "{source}" TO {_COPY_TARGET}')
        finally:
            self._con.execute(f"DETACH {_COPY_TARGET}")

    @staticmethod
    def read_xes(path: str | PathLike, fallback_object_name: str = "LogObject") -> OCEL:
        return OCEL.from_pm4py(create_ocel_from_xml(str(path), fallback_object_name))

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
            events=self.events.df,
            objects=self.objects.df,
            relations=self.e2o.df,
            o2o=self.o2o.df.rename(columns=_O2O_TO_PM4PY),
            object_changes=self.objects.changes,
        )

    def filter(self, pipeline: Sequence[BaseFilter]) -> OCEL:
        """
        Apply a sequence of filters to this OCEL instance.

        Each filter names the event/object ids it keeps; the pipeline keeps what
        all of them keep. The result is a new OCEL over its own database, cleaned
        so it is a valid log in its own right: relations whose event or object is
        gone go too, and an entity left in no relation goes with them. This OCEL is
        untouched.

        Args:
            pipeline (list[BaseFilter]):
                A list of filter objects, each implementing ``keep()``.

        Returns:
            OCEL: A new OCEL instance holding the filtered log.
        """
        from ocelescope.ocel.filter.engine import apply_filters

        return apply_filters(ocel=self, filters=pipeline)

    def write(self, path: str | Path):
        """
        Write the OCEL log and all registered extensions to disk.

        The log is streamed straight out of this OCEL's database by the exporters
        one entity at a time, so writing never materializes the whole log -- and
        the quantity extension, being tables like any other, goes with it.

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
        from ocelescope.ocel.io import export_duckdb_ocel

        path = Path(path)

        if path.suffix not in {".xmlocel", ".xml", ".jsonocel", ".json", ".sqlite"}:
            raise ValueError(f"Unsupported extension: {path.suffix}")

        export_duckdb_ocel(self._con, path)
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

    def __deepcopy__(
        self,
    ):

        return OCEL(
            self._copy_database(),
        )

    def _copy_database(self) -> duckdb.DuckDBPyConnection:
        """Copy every stored table into a new in-memory database.

        The tables are moved across as Arrow, which keeps their stored schema
        exactly -- including the quantity tables, and without reshaping anything
        into pandas on the way.

        This is table-by-table rather than the single ``COPY FROM DATABASE`` that
        :meth:`to_duckdb` gets to use, because that statement needs both databases
        attached to one instance. ``to_duckdb`` can arrange that -- its target is a
        file, and a file can be attached. A clone cannot: ``ATTACH ':memory:'``
        would put it inside *this* instance, where it dies with this connection
        (and holding it open through a cursor doesn't help -- a cursor closes with
        its parent), while a second ``duckdb.connect(':memory:')`` is a separate
        instance that this one has no way to reach.
        """
        clone = duckdb.connect(":memory:")
        try:
            set_utc(clone)
            tables = self._con.execute(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'main' AND table_type = 'BASE TABLE'"
            ).fetchall()
            for (name,) in tables:
                clone.from_arrow(self._con.table(name).to_arrow_table()).create(name)
        except Exception:
            clone.close()
            raise
        return clone

    def __str__(self):
        return f"OCEL [{len(self.events.df)} events, {len(self.objects.df)} objects]"

    def __repr__(self):
        return str(self)
