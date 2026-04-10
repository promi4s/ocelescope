# from typing import Literal, cast

# import pandas as pd

# from ocelescope.ocel.constants.annotations import (
#     ANN_CATEGORY_NAME,
#     ANN_CATEGORY_VALUE,
#     ANN_ELEMENT_ID,
#     ANN_ELEMENT_TYPE,
#     ANN_LABEL_NAME,
#     AnnotationElementType,
# )
# from ocelescope.ocel.constants.pm4py import ACTIVITY_COL, EID_COL, OID_COL, OTYPE_COL
# from ocelescope.ocel.filter.base import BaseFilter, FilterResult


# class LabelFilter(BaseFilter):
#     """Filter events or objects by whether they carry a given label."""

#     label_name: str
#     element_type: AnnotationElementType
#     mode: Literal["include", "exclude"] = "include"

#     def filter(self, ocel) -> FilterResult:
#         labels_df = ocel.annotations.labels
#         matching = labels_df.loc[
#             (labels_df[ANN_LABEL_NAME] == self.label_name)
#             & (labels_df[ANN_ELEMENT_TYPE] == self.element_type),
#             ANN_ELEMENT_ID,
#         ]
#         element_ids = set(matching)

#         match self.element_type:
#             case "event":
#                 mask = cast(pd.Series, ocel.events.df[EID_COL].isin(element_ids))
#                 if self.mode == "exclude":
#                     mask = ~mask
#                 return FilterResult(events=mask)

#             case "activity":
#                 mask = cast(pd.Series, ocel.events.df[ACTIVITY_COL].isin(element_ids))
#                 if self.mode == "exclude":
#                     mask = ~mask
#                 return FilterResult(events=mask)

#             case "object":
#                 mask = cast(pd.Series, ocel.objects.df[OID_COL].isin(element_ids))
#                 if self.mode == "exclude":
#                     mask = ~mask
#                 return FilterResult(objects=mask)

#             case "object_type":
#                 mask = cast(pd.Series, ocel.objects.df[OTYPE_COL].isin(element_ids))
#                 if self.mode == "exclude":
#                     mask = ~mask
#                 return FilterResult(objects=mask)

#             case "item_type":
#                 # Item types are not directly filterable as events/objects.
#                 # Return no-op filter result.
#                 return FilterResult()


# class CategoryFilter(BaseFilter):
#     """Filter events or objects by their category value."""

#     category_name: str
#     element_type: AnnotationElementType
#     values: list[str]
#     mode: Literal["include", "exclude"] = "include"

#     def filter(self, ocel) -> FilterResult:
#         cat_df = ocel.annotations.categories
#         matching = cat_df.loc[
#             (cat_df[ANN_CATEGORY_NAME] == self.category_name)
#             & (cat_df[ANN_ELEMENT_TYPE] == self.element_type)
#             & (cat_df[ANN_CATEGORY_VALUE].isin(self.values)),
#             ANN_ELEMENT_ID,
#         ]
#         element_ids = set(matching)

#         match self.element_type:
#             case "event":
#                 mask = cast(pd.Series, ocel.events.df[EID_COL].isin(element_ids))
#                 if self.mode == "exclude":
#                     mask = ~mask
#                 return FilterResult(events=mask)

#             case "activity":
#                 mask = cast(pd.Series, ocel.events.df[ACTIVITY_COL].isin(element_ids))
#                 if self.mode == "exclude":
#                     mask = ~mask
#                 return FilterResult(events=mask)

#             case "object":
#                 mask = cast(pd.Series, ocel.objects.df[OID_COL].isin(element_ids))
#                 if self.mode == "exclude":
#                     mask = ~mask
#                 return FilterResult(objects=mask)

#             case "object_type":
#                 mask = cast(pd.Series, ocel.objects.df[OTYPE_COL].isin(element_ids))
#                 if self.mode == "exclude":
#                     mask = ~mask
#                 return FilterResult(objects=mask)

#             case "item_type":
#                 # again, item_types are not filterable in the sense of objects and events
#                 return FilterResult()
