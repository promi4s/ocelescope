import {
  compatibleVisualizations,
  type VisualizationKind,
} from "../lib/analyticalCapabilities";
import type { DistributionVisualization } from "../model/dashboard";
import {
  type AnalysisForm,
  type Field,
  type FieldContext,
  type FieldValues,
  list,
  number,
  type QueryObject,
  text,
} from "./fields";
import { activitiesOf, attributesOf, distinct, objectTypesOf } from "./sources";

/**
 * The ten analyses, as data. A form is its fields; the spec is derived from
 * them, because every field key is already the name of a query parameter.
 * Only the three places where that mapping is not literal say anything more.
 */

/* -------------------------------------------------------------------------- */
/* Shared fields                                                              */
/* -------------------------------------------------------------------------- */

type SelectOptions = (
  context: FieldContext,
) => Array<{ value: string; label: string } | string>;

const titleField = (placeholder: string): Field => ({
  kind: "text",
  key: "title",
  label: "Custom title",
  description: "Optional",
  placeholder,
  optional: true,
});

const objectTypeField = (description?: string): Field => ({
  kind: "select",
  key: "object_type",
  label: "Object type",
  ...(description ? { description } : {}),
  options: ({ sources }) => sources.objectTypes,
});

const activityField = (
  description?: string,
  options?: SelectOptions,
): Field => ({
  kind: "select",
  key: "activity",
  label: "Activity",
  ...(description ? { description } : {}),
  options: options ?? (({ sources }) => sources.activities),
});

const activitiesField = (description: string): Field => ({
  kind: "multiselect",
  key: "activities",
  label: "Activities",
  description,
  selectAllByDefault: true,
  options: ({ sources }) => sources.activities,
});

const visualizationLabels: Record<DistributionVisualization, string> = {
  bar: "Bar chart",
  donut: "Donut chart",
  histogram: "Histogram",
};

const isDistribution = (
  value: VisualizationKind,
): value is DistributionVisualization =>
  value === "bar" || value === "donut" || value === "histogram";

function selectedAttribute(
  { sources, values }: FieldContext,
  kind: "event" | "object",
) {
  const entity = text(values, kind === "event" ? "activity" : "object_type");
  const pool =
    kind === "event" ? sources.eventAttributes : sources.objectAttributes;
  const name = text(values, "attribute");
  return attributesOf(pool, entity).find(
    (attribute) => attribute.name === name,
  );
}

const attributeField = (kind: "event" | "object"): Field => {
  const parent = kind === "event" ? "activity" : "object_type";
  return {
    kind: "select",
    key: "attribute",
    label: kind === "event" ? "Attribute" : "Object attribute",
    dependsOn: [parent],
    waitingFor: `Select ${kind === "event" ? "an activity" : "an object type"} first`,
    description: (context) => {
      const attribute = selectedAttribute(context, kind);
      return attribute
        ? `${attribute.type} · ${attribute.analytical_type}`
        : undefined;
    },
    options: ({ sources, values }) =>
      attributesOf(
        kind === "event" ? sources.eventAttributes : sources.objectAttributes,
        text(values, parent),
      ).map((attribute) => attribute.name),
  };
};

/** Only the chart types the attribute's analytical type actually supports. */
const visualizationField = (kind: "event" | "object"): Field => ({
  kind: "select",
  key: "visualization",
  label: "Visualization",
  description: "Choose how the distribution should be shown.",
  dependsOn: ["attribute"],
  waitingFor: "Select an attribute first",
  options: (context) => {
    const attribute = selectedAttribute(context, kind);
    if (!attribute) return [];
    return compatibleVisualizations(attribute.analytical_type)
      .filter(isDistribution)
      .map((value) => ({ value, label: visualizationLabels[value] }));
  },
});

const categoryLimitField = (): Field => ({
  kind: "number",
  key: "limit",
  label: "Maximum categories",
  description: "Remaining values are combined into Other.",
  min: 1,
  max: 500,
  initial: 50,
  visibleIf: ({ values }) => {
    const visualization = text(values, "visualization");
    return visualization === "bar" || visualization === "donut";
  },
});

/* -------------------------------------------------------------------------- */
/* The three non-literal mappings                                             */
/* -------------------------------------------------------------------------- */

/** Bars and donuts cap the categories; a histogram bins instead. */
const groupByVisualization = (
  { limit: _limit, ...rest }: QueryObject,
  values: FieldValues,
): QueryObject => ({
  ...rest,
  grouping:
    text(values, "visualization") === "histogram"
      ? { kind: "bins" }
      : { kind: "categories", limit: number(values, "limit") ?? 50 },
});

/** Selecting every activity is stored as "all activities". */
const allOrSubset = (
  query: QueryObject,
  values: FieldValues,
  { sources }: FieldContext,
): QueryObject => ({
  ...query,
  activities:
    list(values, "activities").length === sources.activities.length
      ? []
      : list(values, "activities"),
});

/* -------------------------------------------------------------------------- */
/* The analyses                                                               */
/* -------------------------------------------------------------------------- */

export const eventAttributeDistribution: AnalysisForm = {
  fields: [
    activityField(),
    attributeField("event"),
    visualizationField("event"),
    categoryLimitField(),
    titleField("Distribution title"),
  ],
  query: groupByVisualization,
};

export const objectAttributeDistribution: AnalysisForm = {
  fields: [
    activityField(
      "Only activities related to object types with attributes are shown.",
      ({ sources }) =>
        activitiesOf(sources.pairs, entityTypes(sources.objectAttributes)),
    ),
    {
      kind: "select",
      key: "object_type",
      label: "Object type",
      description: "Only object types involved in the selected activity.",
      dependsOn: ["activity"],
      waitingFor: "Select an activity first",
      options: ({ sources, values }) =>
        objectTypesOf(
          sources.pairs,
          text(values, "activity"),
          entityTypes(sources.objectAttributes),
        ),
    },
    attributeField("object"),
    visualizationField("object"),
    categoryLimitField(),
    titleField("Distribution title"),
  ],
  query: groupByVisualization,
};

export const objectInvolvementDistribution: AnalysisForm = {
  fields: [
    activityField(
      "Only activities with variable object involvement are shown.",
      ({ sources }) => activitiesOf(sources.variablePairs),
    ),
    {
      kind: "select",
      key: "object_type",
      label: "Object type",
      description: "The observed minimum and maximum counts are shown.",
      dependsOn: ["activity"],
      waitingFor: "Select an activity first",
      options: ({ sources, values }) =>
        sources.variablePairs
          .filter((pair) => pair.activity === text(values, "activity"))
          .map((pair) => ({
            value: pair.objectType,
            label: `${pair.objectType} (${pair.minCount}-${pair.maxCount})`,
          })),
    },
    {
      kind: "select",
      key: "visualization",
      label: "Visualization",
      options: () => [
        { value: "bar", label: "Bar chart" },
        { value: "histogram", label: "Histogram" },
      ],
    },
    titleField("Object involvement distribution"),
  ],
  // A bar chart keeps every distinct count; a histogram bins them.
  query: (query, values) => ({
    ...query,
    grouping:
      text(values, "visualization") === "histogram"
        ? { kind: "bins" }
        : { kind: "categories", limit: 500 },
  }),
};

export const activityExecutionFrequency: AnalysisForm = {
  fields: [
    objectTypeField(
      "Each object is grouped by its final execution count for every activity.",
    ),
    titleField("Activity execution frequency"),
  ],
};

export const objectActivityExecutionDistribution: AnalysisForm = {
  fields: [
    objectTypeField(),
    titleField("Object activity execution frequency"),
  ],
};

export const objectTypeCombinations: AnalysisForm = {
  fields: [
    activitiesField(
      "Select one activity for simple bars, or several to compare them as stacks.",
    ),
    {
      kind: "number",
      key: "limit",
      label: "Maximum combinations",
      description:
        "The most frequent exact object-type combinations are shown.",
      min: 1,
      max: 50,
      initial: 15,
    },
    titleField("Object-type combinations per event"),
  ],
  query: allOrSubset,
};

export const objectCountsPerEvent: AnalysisForm = {
  fields: [
    activitiesField("All activities are selected by default."),
    titleField("Objects involved per event"),
  ],
  query: allOrSubset,
};

export const timeBetweenActivities: AnalysisForm = {
  fields: [
    {
      kind: "select",
      key: "object_type",
      label: "Object type",
      description:
        "Only object types with event-object relations are available.",
      options: ({ sources }) =>
        distinct(sources.pairs.map((pair) => pair.objectType)).sort(),
    },
    {
      kind: "select",
      key: "source_activity",
      label: "Source activity",
      dependsOn: ["object_type"],
      waitingFor: "Select an object type first",
      options: activitiesForObjectType,
    },
    {
      kind: "select",
      key: "target_activity",
      label: "Target activity",
      description:
        "The target must immediately follow the source after filtering the object trace to these two activities.",
      dependsOn: ["object_type"],
      waitingFor: "Select an object type first",
      options: activitiesForObjectType,
    },
    {
      kind: "select",
      key: "unit",
      label: "Time unit",
      options: () => [
        { value: "seconds", label: "Seconds" },
        { value: "minutes", label: "Minutes" },
        { value: "hours", label: "Hours" },
        { value: "days", label: "Days" },
      ],
    },
    titleField("Time between activities"),
  ],
  values: () => ({ unit: "hours" }),
};

export const totalObjectInvolvement: AnalysisForm = {
  fields: [titleField("Total objects involved in events")],
};

export const objectAttributeTimeline: AnalysisForm = {
  fields: [
    {
      kind: "select",
      key: "object_id",
      label: "Object",
      description:
        "Search by object id. Every attribute of the object's type is plotted.",
      remoteSearch: true,
      // The selected id must survive a later search that no longer returns it.
      options: ({ sources, values }) => {
        const selected = text(values, "object_id");
        return distinct([
          ...(selected ? [selected] : []),
          ...sources.objectIds,
        ]);
      },
    },
    titleField("Object attribute value development"),
  ],
};

function entityTypes(attributes: { entity_type: string }[]): Set<string> {
  return new Set(attributes.map((attribute) => attribute.entity_type));
}

function activitiesForObjectType({ sources, values }: FieldContext): string[] {
  const objectType = text(values, "object_type");
  return distinct(
    sources.pairs
      .filter((pair) => pair.objectType === objectType)
      .map((pair) => pair.activity),
  ).sort();
}
