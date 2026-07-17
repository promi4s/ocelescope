import { EventAttributeDistributionCard } from "./EventAttributeDistributionCard";
import { EventAttributeDistributionEditor } from "./EventAttributeDistributionEditor";
import { ObjectAttributeDistributionCard } from "./ObjectAttributeDistributionCard";
import { ObjectAttributeDistributionEditor } from "./ObjectAttributeDistributionEditor";
import { ObjectCountsPerEventCard } from "./ObjectCountsPerEventCard";
import { ObjectCountsPerEventEditor } from "./ObjectCountsPerEventEditor";
import { ObjectInvolvementDistributionCard } from "./ObjectInvolvementDistributionCard";
import { ObjectInvolvementDistributionEditor } from "./ObjectInvolvementDistributionEditor";
import { ObjectTypeCombinationsCard } from "./ObjectTypeCombinationsCard";
import { ObjectTypeCombinationsEditor } from "./ObjectTypeCombinationsEditor";
import type { AnalysisDefinition } from "./types";
import { TimeBetweenActivitiesCard } from "./TimeBetweenActivitiesCard";
import { TimeBetweenActivitiesEditor } from "./TimeBetweenActivitiesEditor";
import { ObjectActivityExecutionDistributionCard } from "./ObjectActivityExecutionDistributionCard";
import { ObjectActivityExecutionDistributionEditor } from "./ObjectActivityExecutionDistributionEditor";
import { TotalObjectInvolvementCard } from "./TotalObjectInvolvementCard";
import { TotalObjectInvolvementEditor } from "./TotalObjectInvolvementEditor";

export const analysisDefinitions = [
  {
    id: "object-activity-execution-distribution",
    category: "Behavior",
    label: "Object activity execution distribution",
    description:
      "Compare exact lifecycle execution counts for activities with loops.",
    Editor: ObjectActivityExecutionDistributionEditor,
    Card: ObjectActivityExecutionDistributionCard,
  },
  {
    id: "total-object-involvement",
    category: "Relationships",
    label: "Total objects involved in events",
    description:
      "Show event frequencies by total distinct object count, stacked by activity.",
    Editor: TotalObjectInvolvementEditor,
    Card: TotalObjectInvolvementCard,
  },
  {
    id: "time-between-activities",
    category: "Time",
    label: "Time between activities",
    description:
      "Show the duration distribution of consecutive source-to-target pairs in filtered object traces.",
    Editor: TimeBetweenActivitiesEditor,
    Card: TimeBetweenActivitiesCard,
  },
  {
    id: "object-involvement-distribution",
    category: "Relationships",
    label: "Object involvement distribution",
    description:
      "Show how the number of involved objects varies across executions of an activity.",
    Editor: ObjectInvolvementDistributionEditor,
    Card: ObjectInvolvementDistributionCard,
  },
  {
    id: "activity-execution-frequency",
    category: "Behavior",
    label: "Activity execution frequency",
    description:
      "Group objects by how often they execute each activity across their lifecycle.",
    Editor: ActivityExecutionFrequencyEditor,
    Card: ActivityExecutionFrequencyCard,
  },
  {
    id: "object-type-combinations",
    category: "Relationships",
    label: "Object-type combinations per event",
    description:
      "Compare exact sets of object types present in events, broken down by activity.",
    Editor: ObjectTypeCombinationsEditor,
    Card: ObjectTypeCombinationsCard,
  },
  {
    id: "object-counts-per-event",
    category: "Relationships",
    label: "Objects involved per event",
    description:
      "Explore how many distinct objects of each type participate in events, grouped by activity.",
    Editor: ObjectCountsPerEventEditor,
    Card: ObjectCountsPerEventCard,
  },
  {
    id: "event-attribute-distribution",
    category: "Attributes",
    label: "Event attribute distribution",
    description:
      "Compare the frequencies of categorical values or the numeric distribution of an event attribute.",
    Editor: EventAttributeDistributionEditor,
    Card: EventAttributeDistributionCard,
  },
  {
    id: "object-attribute-distribution",
    category: "Attributes",
    label: "Object attribute distribution",
    description:
      "Compare object attribute values at the time objects participate in events of a selected activity.",
    Editor: ObjectAttributeDistributionEditor,
    Card: ObjectAttributeDistributionCard,
  },
] as const satisfies readonly AnalysisDefinition[];

export function findAnalysisDefinition(id: string) {
  return analysisDefinitions.find((definition) => definition.id === id);
}

import { ActivityExecutionFrequencyCard } from "./ActivityExecutionFrequencyCard";
import { ActivityExecutionFrequencyEditor } from "./ActivityExecutionFrequencyEditor";
