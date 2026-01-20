from typing import TYPE_CHECKING, Iterable, cast

import pandas as pd

from ocelescope.ocel.constants.pm4py import OID_COL, OTYPE_COL
from ocelescope.ocel.managers.base import BaseManager
from ocelescope.ocel.models.attributes import AttributeSummary
from ocelescope.ocel.util.attributes import summarize_object_attributes
from ocelescope.util.cache import instance_lru_cache

if TYPE_CHECKING:
    from ocelescope.ocel.core.ocel import OCEL


class ObjectsManager(BaseManager):
    """
    Manages object-level information within an OCEL instance.

    Provides access to:
    - the objects table
    - the object_changes table
    - object types and counts
    - object attribute names
    - per-object lookup helpers such as type-by-id

    Acts as a facade over the underlying PM4PY OCEL object.
    """

    def __init__(self, ocel: "OCEL"):
        super().__init__()
        self._ocel = ocel

    @property
    def df(self) -> pd.DataFrame:
        """
        Return the object table from the underlying OCEL.

        Returns:
            DataFrame: A pandas DataFrame containing all objects and their static attributes.
        """
        return self._ocel.ocel.objects

    @property
    def changes(self) -> pd.DataFrame:
        """
        Return the dynamic object attribute change table.

        Returns:
            DataFrame: A pandas DataFrame containing all dynamic updates to object attributes.
        """
        return self._ocel.ocel.object_changes

    @property
    @instance_lru_cache()
    def types(self) -> list[str]:
        """
        Return the list of all object types present in the log.

        Returns:
            list[str]: Sorted list of unique object type names.
        """
        return list(sorted(self.df[OTYPE_COL].unique().tolist()))

    @property
    @instance_lru_cache()
    def counts(self) -> pd.Series:
        """
        Count how many objects exist for each object type.

        Returns:
            Series: A pandas Series indexed by object type with occurrence counts.
        """
        return self.df[OTYPE_COL].value_counts()

    @property
    @instance_lru_cache()
    def type_by_id(self) -> pd.Series:
        """
        Return a mapping from object ID to object type.

        Returns:
            Series: A pandas Series indexed by object ID, containing object types as values.
        """
        return cast(pd.Series, self.df[[OID_COL, OTYPE_COL]].set_index(OID_COL)[OTYPE_COL])

    def has_types(self, types: Iterable[str]) -> bool:
        """
        Check whether all provided object types exist in the OCEL.

        Args:
            types: Iterable of object type names to verify.

        Returns:
            bool: True if all types exist, False otherwise.
        """
        return all(ot in self.types for ot in types)

    @property
    def static_attribute_names(self) -> list[str]:
        """
        Return the names of all static object attributes.

        Static attributes are non-OCEL-prefixed columns in the objects
        table that contain at least one non-null value.

        Returns:
            list[str]: Sorted list of static object attribute names.
        """
        return sorted(
            [col for col in self.df.columns[self.df.count() > 0] if not col.startswith("ocel:")]
        )

    @property
    def dynamic_attribute_names(self) -> list[str]:
        """
        Return the names of all dynamic object attributes.

        Dynamic attributes are derived from the object_changes table,
        excluding OCEL system columns and internal counters.

        Returns:
            list[str]: Sorted list of dynamic object attribute names.
        """
        return sorted(
            [
                col
                for col in self.changes.columns[self.changes.count() > 0]
                if not col.startswith("ocel:") and col != "@@cumcount"
            ]
        )

    @property
    def attribute_names(self) -> list[str]:
        """
        Return all object attribute names.

        Combines both static and dynamic attributes into a unified list.

        Returns:
            list[str]: Sorted list of all object attribute names.
        """
        return sorted(set(self.static_attribute_names + self.dynamic_attribute_names))

    @property
    @instance_lru_cache()
    def attribute_summary(self) -> dict[str, list[AttributeSummary]]:
        """
        Summarize all object attributes grouped by object type.

        Summaries include inferred attribute data types, ranges,
        value distributions, and other type-specific metadata.

        Returns:
            dict[str, list[AttributeSummary]]: Mapping of object types to
            lists of structured attribute summaries.
        """
        return summarize_object_attributes(self._ocel.ocel)
