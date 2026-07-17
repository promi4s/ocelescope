from __future__ import annotations

from typing import cast

import pandas as pd

from ocelescope import OCEL
from ocelescope.ocel.constants import ACTIVITY_COL, OID_COL, OTYPE_COL, TIMESTAMP_COL

from ocelescope_module_querying.api.schemas import (
    ActivitySchemaItem,
    AnalyticalSchemaResponse,
    AnalyticalType,
    AttributeClassificationOverride,
    AttributeSchemaItem,
    ObjectAttributeSchemaItem,
    ObjectTypeSchemaItem,
)
from ocelescope_module_querying.attribute_types import (
    attribute_type,
    infer_analytical_type,
    supported_analytical_types,
)
from ocelescope_module_querying.errors import InvalidAnalysisQuery
from ocelescope_module_querying.object_attributes import (
    INITIAL_TIMESTAMP,
    object_attribute_observations,
)


def _event_schema(
    ocel: OCEL, overrides: dict[tuple[str, str, str], AnalyticalType]
) -> list[ActivitySchemaItem]:
    events = ocel.events.df
    activities: list[ActivitySchemaItem] = []
    for activity in ocel.events.activities:
        activity_events = events.loc[events[ACTIVITY_COL].eq(activity)]
        attributes: list[AttributeSchemaItem] = []
        for name in ocel.events.attribute_names:
            values = cast(pd.Series, activity_events[name])
            present = values.dropna()
            if present.empty:
                continue
            physical_type = attribute_type(values)
            inferred_type = infer_analytical_type(values, physical_type)
            attributes.append(
                AttributeSchemaItem(
                    name=name,
                    physical_type=physical_type,
                    inferred_analytical_type=inferred_type,
                    analytical_type=overrides.get(
                        ("event", str(activity), name), inferred_type
                    ),
                    present_count=len(present),
                    missing_count=len(values) - len(present),
                    distinct_count=int(present.nunique()),
                )
            )
        activities.append(
            ActivitySchemaItem(
                name=str(activity),
                event_count=len(activity_events),
                attributes=attributes,
            )
        )
    return activities


def _object_schema(
    ocel: OCEL, overrides: dict[tuple[str, str, str], AnalyticalType]
) -> list[ObjectTypeSchemaItem]:
    result: list[ObjectTypeSchemaItem] = []
    for object_type in ocel.objects.types:
        type_objects = ocel.objects.df.loc[ocel.objects.df[OTYPE_COL].eq(object_type)]
        attributes: list[ObjectAttributeSchemaItem] = []
        for name in ocel.objects.attribute_names:
            observations = object_attribute_observations(ocel, object_type, name)
            if observations.empty:
                continue
            values = cast(pd.Series, observations[name].reset_index(drop=True))
            physical_type = attribute_type(values)
            inferred_type = infer_analytical_type(values, physical_type)
            initial_mask = observations[TIMESTAMP_COL].eq(INITIAL_TIMESTAMP)
            change_mask = observations["_source"].eq("change") & ~initial_mask
            current = observations.drop_duplicates(subset=[OID_COL], keep="last")
            change_count = int(change_mask.sum())
            attributes.append(
                ObjectAttributeSchemaItem(
                    name=name,
                    physical_type=physical_type,
                    inferred_analytical_type=inferred_type,
                    analytical_type=overrides.get(
                        ("object", object_type, name), inferred_type
                    ),
                    present_count=int(current[OID_COL].nunique()),
                    missing_count=len(type_objects) - int(current[OID_COL].nunique()),
                    distinct_count=int(values.nunique()),
                    behavior="dynamic" if change_count else "static",
                    initial_present_count=int(
                        observations.loc[initial_mask, OID_COL].nunique()
                    ),
                    current_present_count=int(current[OID_COL].nunique()),
                    observed_value_count=len(observations),
                    change_count=change_count,
                    changed_object_count=int(
                        observations.loc[change_mask, OID_COL].nunique()
                    ),
                )
            )
        result.append(
            ObjectTypeSchemaItem(
                name=object_type,
                object_count=len(type_objects),
                attributes=attributes,
            )
        )
    return result


def describe_analytical_schema(
    ocel: OCEL,
    overrides: dict[tuple[str, str, str], AnalyticalType] | None = None,
) -> AnalyticalSchemaResponse:
    overrides = overrides or {}
    return AnalyticalSchemaResponse(
        activities=_event_schema(ocel, overrides),
        object_types=_object_schema(ocel, overrides),
    )


def validate_schema_overrides(
    ocel: OCEL, requested: list[AttributeClassificationOverride]
) -> dict[tuple[str, str, str], AnalyticalType]:
    schema = describe_analytical_schema(ocel)
    attributes = {
        **{
            ("event", activity.name, attribute.name): attribute
            for activity in schema.activities
            for attribute in activity.attributes
        },
        **{
            ("object", object_type.name, attribute.name): attribute
            for object_type in schema.object_types
            for attribute in object_type.attributes
        },
    }
    validated: dict[tuple[str, str, str], AnalyticalType] = {}
    for override in requested:
        key = (override.scope, override.entity_type, override.attribute)
        attribute = attributes.get(key)
        if attribute is None:
            raise InvalidAnalysisQuery(
                f"Unknown {override.scope} attribute '{override.attribute}' "
                f"for '{override.entity_type}'"
            )
        if override.analytical_type not in supported_analytical_types(
            attribute.physical_type
        ):
            raise InvalidAnalysisQuery(
                f"'{override.analytical_type}' is not a valid interpretation for "
                f"{attribute.physical_type} values"
            )
        if override.analytical_type != attribute.inferred_analytical_type:
            validated[key] = override.analytical_type
    return validated
