import * as cards from "./cards";
import * as forms from "./forms";
import type { AnalysisDefinition } from "./types";

export const analysisDefinitions = [
  {
    id: "object-activity-execution-distribution",
    category: "Behavior",
    label: "Object activity execution distribution",
    description:
      "Compare exact lifecycle execution counts for activities with loops.",
    form: forms.objectActivityExecutionDistribution,
    card: cards.objectActivityExecutionDistribution,
  },
  {
    id: "total-object-involvement",
    category: "Relationships",
    label: "Total objects involved in events",
    description:
      "Show event frequencies by total distinct object count, stacked by activity.",
    form: forms.totalObjectInvolvement,
    card: cards.totalObjectInvolvement,
  },
  {
    id: "time-between-activities",
    category: "Time",
    label: "Time between activities",
    description:
      "Show the duration distribution of consecutive source-to-target pairs in filtered object traces.",
    form: forms.timeBetweenActivities,
    card: cards.timeBetweenActivities,
  },
  {
    id: "object-involvement-distribution",
    category: "Relationships",
    label: "Object involvement distribution",
    description:
      "Show how the number of involved objects varies across executions of an activity.",
    form: forms.objectInvolvementDistribution,
    card: cards.objectInvolvementDistribution,
  },
  {
    id: "activity-execution-frequency",
    category: "Behavior",
    label: "Activity execution frequency",
    description:
      "Group objects by how often they execute each activity across their lifecycle.",
    form: forms.activityExecutionFrequency,
    card: cards.activityExecutionFrequency,
  },
  {
    id: "object-type-combinations",
    category: "Relationships",
    label: "Object-type combinations per event",
    description:
      "Compare exact sets of object types present in events, broken down by activity.",
    form: forms.objectTypeCombinations,
    card: cards.objectTypeCombinations,
  },
  {
    id: "object-counts-per-event",
    category: "Relationships",
    label: "Objects involved per event",
    description:
      "Explore how many distinct objects of each type participate in events, grouped by activity.",
    form: forms.objectCountsPerEvent,
    card: cards.objectCountsPerEvent,
  },
  {
    id: "event-attribute-distribution",
    category: "Attributes",
    label: "Event attribute distribution",
    description:
      "Compare the frequencies of categorical values or the numeric distribution of an event attribute.",
    form: forms.eventAttributeDistribution,
    card: cards.eventAttributeDistribution,
  },
  {
    id: "object-attribute-distribution",
    category: "Attributes",
    label: "Object attribute distribution",
    description:
      "Compare object attribute values at the time objects participate in events of a selected activity.",
    form: forms.objectAttributeDistribution,
    card: cards.objectAttributeDistribution,
  },
  {
    id: "object-attribute-timeline",
    category: "Attributes",
    label: "Object attribute value development",
    description:
      "Track how every attribute of a single object changed over its lifetime, alongside its own events.",
    form: forms.objectAttributeTimeline,
    card: cards.objectAttributeTimeline,
  },
] as const satisfies readonly AnalysisDefinition[];

export function findAnalysisDefinition(id: string) {
  return analysisDefinitions.find((definition) => definition.id === id);
}
