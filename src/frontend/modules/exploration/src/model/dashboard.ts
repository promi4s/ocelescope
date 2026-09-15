import type {
  ActivityExecutionFrequency,
  EventAttributeDistribution,
  ObjectActivityExecutionDistribution,
  ObjectAttributeDistribution,
  ObjectAttributeTimeline,
  ObjectCountsPerEvent,
  ObjectInvolvementDistribution,
  ObjectTypeCombinations,
  TimeBetweenActivities,
} from "../api/exploration";

/** A query as the dashboard stores it: the `analysis` tag lives on the spec. */
type Stored<Q> = Omit<Q, "analysis">;

export type DistributionVisualization = "bar" | "donut" | "histogram";

export interface EventAttributeDistributionSpec {
  analysis: "event-attribute-distribution";
  query: Stored<EventAttributeDistribution>;
  visualization: DistributionVisualization;
  title?: string;
}

export interface ActivityExecutionFrequencySpec {
  analysis: "activity-execution-frequency";
  query: Stored<ActivityExecutionFrequency>;
  title?: string;
}

export interface ObjectAttributeDistributionSpec {
  analysis: "object-attribute-distribution";
  query: Stored<ObjectAttributeDistribution>;
  visualization: DistributionVisualization;
  title?: string;
}

export interface ObjectCountsPerEventSpec {
  analysis: "object-counts-per-event";
  query: Stored<ObjectCountsPerEvent>;
  title?: string;
}

export interface ObjectInvolvementDistributionSpec {
  analysis: "object-involvement-distribution";
  query: Stored<ObjectInvolvementDistribution>;
  visualization: "bar" | "histogram";
  title?: string;
}

export interface ObjectTypeCombinationsSpec {
  analysis: "object-type-combinations";
  query: Stored<ObjectTypeCombinations>;
  title?: string;
}

export interface TimeBetweenActivitiesSpec {
  analysis: "time-between-activities";
  query: Stored<TimeBetweenActivities>;
  title?: string;
}

export interface ObjectActivityExecutionDistributionSpec {
  analysis: "object-activity-execution-distribution";
  query: Stored<ObjectActivityExecutionDistribution>;
  title?: string;
}

export interface TotalObjectInvolvementSpec {
  analysis: "total-object-involvement";
  title?: string;
}

export interface ObjectAttributeTimelineSpec {
  analysis: "object-attribute-timeline";
  query: Stored<ObjectAttributeTimeline>;
  title?: string;
}

export type VisualizationSpec =
  | ActivityExecutionFrequencySpec
  | EventAttributeDistributionSpec
  | ObjectAttributeDistributionSpec
  | ObjectCountsPerEventSpec
  | ObjectInvolvementDistributionSpec
  | ObjectTypeCombinationsSpec
  | TimeBetweenActivitiesSpec
  | ObjectActivityExecutionDistributionSpec
  | TotalObjectInvolvementSpec
  | ObjectAttributeTimelineSpec;

export interface DashboardCardDefinition {
  id: string;
  spec: VisualizationSpec;
}

export interface StoredDashboard {
  cards: DashboardCardDefinition[];
}
