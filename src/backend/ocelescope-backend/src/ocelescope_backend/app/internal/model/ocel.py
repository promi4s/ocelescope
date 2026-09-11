from pathlib import Path
from typing import Sequence

from ocelescope.ocel.io import export_duckdb_ocel

from ocelescope import OCEL, BaseFilter


class SessionOCEL:
    """A handle to an OCEL persisted as a DuckDB file on disk.

    The log is never held in the session. A global filter pipeline
    (:class:`ModuleFilter` s, grouped by the module that set them) defines a *view*,
    applied **once** -- when the pipeline changes -- into a filtered DuckDB file
    beside the origin. Reads then open that file, so a per-request access never
    re-runs the filter; ``use_original`` reads the origin instead.
    """

    def __init__(
        self,
        id: str,
        db_path: Path,
        name: str,
        created_at: str,
    ):
        self.id = id
        self.db_path = db_path
        self.name = name
        self.created_at = created_at
        self._filters_by_source: dict[str, list[BaseFilter]] = {}
        self._filtered_db_path: Path | None = None
        self._filtered_generation = 0

    def _all_filters(self) -> list[BaseFilter]:
        return [f for pipeline in self._filters_by_source.values() for f in pipeline]

    def _active_path(self, use_original: bool) -> Path:
        """The DuckDB file to read: the origin, or the (once-computed) filtered one.

        The filtered file is built by reading the origin, applying the pipeline and
        writing the result back out -- so the cost is paid here, when the pipeline
        changes, rather than on every read.

        """
        filters = self._all_filters()
        if use_original or not filters:
            return self.db_path
        if self._filtered_db_path is None:
            self._filtered_generation += 1
            filtered = self.db_path.with_suffix(
                f".filtered.{self._filtered_generation}.duckdb"
            )
            with OCEL.read_duckdb(self.db_path, read_only=True) as origin:
                with origin.filter(filters) as subset:
                    subset.to_duckdb(filtered)
            self._filtered_db_path = filtered
        return self._filtered_db_path

    def ocel(self, use_original: bool = False) -> OCEL:
        """The OCEL over the active DuckDB file (filtered unless ``use_original``).

        Opened read-only: the file is the session's, and a request has no business
        writing to it. Its tables are read out of the file only as they are asked
        for, so this call itself loads nothing.
        """
        ocel = OCEL.read_duckdb(self._active_path(use_original), read_only=True)

        return ocel

    def export(self, target_path: Path, use_original: bool = False) -> None:
        """Write the OCEL to ``target_path`` straight from the DuckDB store.

        Streams the log (and quantities) from the active DuckDB file entity-by-entity
        rather than materializing the whole OCEL, then re-exports the in-memory
        session extensions (which aren't persisted to DuckDB) so the output matches
        :meth:`ocel` + :meth:`OCEL.write`. The target format is chosen from the file
        extension (``.json`` / ``.xml`` / ``.sqlite``).
        """
        export_duckdb_ocel(self._active_path(use_original), target_path)

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

    def get_filters(self, module_source: str | None = None) -> list[BaseFilter]:
        if module_source is None:
            return self._all_filters()
        return list(self._filters_by_source.get(module_source, []))

    def set_filters(self, module_source: str, pipeline: Sequence[BaseFilter]):
        self._filters_by_source[module_source] = list(pipeline)
        self._drop_filtered()
        if self._all_filters():
            self._active_path(use_original=False)
