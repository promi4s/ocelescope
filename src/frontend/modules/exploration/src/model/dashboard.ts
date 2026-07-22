import type {
  ActivityExecutionFrequencyQuery,
  EventAttributeDistributionQuery,
  ObjectActivityExecutionDistributionQuery,
  ObjectAttributeDistributionQuery,
  ObjectCountsPerEventQuery,
  ObjectInvolvementDistributionQuery,
  ObjectTypeCombinationsQuery,
  TimeBetweenActivitiesQuery,
} from "../api/exploration";

export type DistributionVisualization = "bar" | "donut" | "histogram";

export interface EventAttributeDistributionSpec {
  analysis: "event-attribute-distribution";
  query: EventAttributeDistributionQuery;
  visualization: DistributionVisualization;
  title?: string;
}

export interface ActivityExecutionFrequencySpec {
  analysis: "activity-execution-frequency";
  query: ActivityExecutionFrequencyQuery;
  title?: string;
}

export interface ObjectAttributeDistributionSpec {
  analysis: "object-attribute-distribution";
  query: ObjectAttributeDistributionQuery;
  visualization: DistributionVisualization;
  title?: string;
}

export interface ObjectCountsPerEventSpec {
  analysis: "object-counts-per-event";
  query: ObjectCountsPerEventQuery;
  title?: string;
}

export interface ObjectInvolvementDistributionSpec {
  analysis: "object-involvement-distribution";
  query: ObjectInvolvementDistributionQuery;
  visualization: "bar" | "histogram";
  title?: string;
}

export interface ObjectTypeCombinationsSpec {
  analysis: "object-type-combinations";
  query: ObjectTypeCombinationsQuery;
  title?: string;
}

export interface TimeBetweenActivitiesSpec {
  analysis: "time-between-activities";
  query: TimeBetweenActivitiesQuery;
  title?: string;
}

export interface ObjectActivityExecutionDistributionSpec {
  analysis: "object-activity-execution-distribution";
  query: ObjectActivityExecutionDistributionQuery;
  title?: string;
}

export interface TotalObjectInvolvementSpec {
  analysis: "total-object-involvement";
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
  | TotalObjectInvolvementSpec;

export interface DashboardCardDefinition {
  id: string;
  spec: VisualizationSpec;
}

export interface StoredDashboard {
  cards: DashboardCardDefinition[];
}
