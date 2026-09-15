import { Group, Stack, Text } from "@mantine/core";
import { Chart, type Row } from "@ocelescope/charts";
import type { ReactNode } from "react";

import type { VisualizationSpec } from "../model/dashboard";
import { type Bucket, DistributionChart } from "./DistributionChart";

/*
 * Every analysis answers with `{ rows, meta }` of generic records. These are
 * the columns and figures each card reads from it.
 */
type Data<R, M> = { rows: R[]; meta: M };
/** How the backend bins a histogram, in words. */
const binning = (count?: number | null) =>
  count
    ? `grouped into ${count} equal intervals`
    : "grouped into equal intervals sized by the Freedman–Diaconis rule, with far outliers counted in separate “<” and “>” bars";

type DistributionMeta = { total: number; missing: number; truncated: boolean };
type TimeBetweenData = Data<
  Bucket,
  DistributionMeta & { pair_count: number; contributing_object_count: number }
>;
type ExecutionFrequencyData = Data<
  { activity: string; band: string; object_count: number },
  {
    object_count: number;
    object_activity_pair_count: number;
    maximum_execution_count: number;
  }
>;
type TypeCombinationsData = Data<
  { object_types: string[]; activity: string; event_count: number },
  { total_event_count: number; total_combination_count: number }
>;
type CountsPerEventRow = {
  activity: string;
  object_type: string;
  object_count: number;
  event_count: number;
};
type CountsPerEventData = Data<
  CountsPerEventRow,
  { activity_event_counts: Record<string, number> }
>;
type ExecutionDistributionData = Data<
  { activity: string; execution_count: number; object_count: number },
  { object_count: number; activity_count: number }
>;
type TotalInvolvementData = Data<
  { activity: string; object_count: number; event_count: number },
  { event_count: number }
>;
type TimelineData = Data<
  { activity: string | null; values: Record<string, unknown> },
  { object_type: string; attributes: string[] }
>;

/**
 * What a card shows, per analysis. Everything a card used to repeat — the hook
 * call, the union narrowing, the Paper/title/export chrome — now lives once in
 * `AnalysisCard`, so only the wording and the chart stay here.
 */

export interface ChartSlot {
  loading: boolean;
  empty: boolean;
  emptyMessage: string;
}

export interface CardView<S = VisualizationSpec, D = unknown> {
  title: (spec: S) => string;
  subtitle?: (spec: S) => string;
  info: (spec: S) => ReactNode;
  filename: string;
  emptyMessage: string;
  /** Overrides the "no rows" default, e.g. when a total is zero. */
  isEmpty?: (data: D) => boolean;
  note?: (data: D, spec: S) => ReactNode;
  chart: (data: D | undefined, spec: S, slot: ChartSlot) => ReactNode;
}

/** Keeps each view's body narrowed while the registry stays uniform. */
function defineCard<A extends VisualizationSpec["analysis"], D>(
  _analysis: A,
  view: CardView<Extract<VisualizationSpec, { analysis: A }>, D>,
): CardView {
  return view as unknown as CardView;
}

const Question = ({
  question,
  determination,
  children,
}: {
  question: ReactNode;
  determination: ReactNode;
  children?: ReactNode;
}) => (
  <Stack gap="xs">
    <div>
      <Text size="xs" fw={700} tt="uppercase" c="dimmed">
        Question
      </Text>
      <Text size="sm">{question}</Text>
    </div>
    <div>
      <Text size="xs" fw={700} tt="uppercase" c="dimmed">
        Determination
      </Text>
      <Text size="sm">{determination}</Text>
    </div>
    {children}
  </Stack>
);

const Pair = ({ left, right }: { left: ReactNode; right: ReactNode }) => (
  <Group justify="space-between" gap="xs">
    <Text size="xs" c="dimmed">
      {left}
    </Text>
    <Text size="xs" c="dimmed">
      {right}
    </Text>
  </Group>
);

/** The four bucket-shaped analyses share one result shape; only wording differs. */
type Distribution = Data<Bucket, DistributionMeta>;

const distributionNote = (population: string) => (data: Distribution) => (
  <Pair
    left={`${data.meta.total.toLocaleString()} ${population}`}
    right={`${data.meta.missing.toLocaleString()} missing`}
  />
);

const distributionChart =
  (seriesName: string) =>
  (
    data: Distribution | undefined,
    spec: { visualization: "bar" | "donut" | "histogram" },
    slot: ChartSlot,
  ) => (
    <DistributionChart
      buckets={data?.rows ?? []}
      visualization={spec.visualization}
      seriesName={seriesName}
      {...slot}
    />
  );

/* -------------------------------------------------------------------------- */

export const eventAttributeDistribution = defineCard<
  "event-attribute-distribution",
  Distribution
>("event-attribute-distribution", {
  title: (spec) => spec.title || `${spec.query.attribute} distribution`,
  subtitle: (spec) => `Activity · ${spec.query.activity}`,
  filename: "event-attribute-distribution",
  emptyMessage: "No matching events are available in the active OCEL.",
  info: (spec) => (
    <Question
      question={`How is ${spec.query.attribute} distributed for events with activity “${spec.query.activity}”?`}
      determination={
        spec.query.grouping.kind === "bins"
          ? `Numeric values are ${binning(spec.query.grouping.count)}.`
          : "Equal values are grouped together and counted."
      }
    >
      <Text size="sm">
        Missing values are included as a separate group. The active filtered
        OCEL is used.
      </Text>
    </Question>
  ),
  isEmpty: (data) => data.meta.total === 0,
  note: distributionNote("events"),
  chart: distributionChart("Events"),
});

export const objectAttributeDistribution = defineCard<
  "object-attribute-distribution",
  Distribution
>("object-attribute-distribution", {
  title: (spec) => spec.title || `${spec.query.attribute} distribution`,
  subtitle: (spec) => `${spec.query.activity} · ${spec.query.object_type}`,
  filename: "object-attribute-distribution",
  emptyMessage:
    "No matching event–object pairs are available in the active OCEL.",
  info: (spec) => (
    <Question
      question={`Which ${spec.query.attribute} values did ${spec.query.object_type} objects have when they participated in “${spec.query.activity}” events?`}
      determination="Each unique event–object pair is counted once. The value is the latest object attribute value at or before the event timestamp; an initial object-table value is effective from 1970."
    >
      <Text size="sm">
        A change at the event timestamp already applies to that event. Missing
        values are shown separately, and the active filtered OCEL is used.
      </Text>
    </Question>
  ),
  isEmpty: (data) => data.meta.total === 0,
  note: distributionNote("event–object pairs"),
  chart: distributionChart("Event–object pairs"),
});

export const objectInvolvementDistribution = defineCard<
  "object-involvement-distribution",
  Distribution
>("object-involvement-distribution", {
  title: (spec) => spec.title || "Object involvement distribution",
  subtitle: (spec) => `${spec.query.activity} · ${spec.query.object_type}`,
  filename: "object-involvement-distribution",
  emptyMessage: "No matching events are available in the active OCEL.",
  info: (spec) => (
    <Stack gap="xs">
      <Text size="sm">
        Shows how many distinct {spec.query.object_type} objects are involved in
        each “{spec.query.activity}” event.
      </Text>
      <Text size="sm">
        Every event is counted once. Duplicate event–object relations are
        removed, and zero is included when an event has no object of the
        selected type.
      </Text>
      <Text size="sm">
        {spec.visualization === "histogram"
          ? `Counts are ${binning(spec.query.grouping.kind === "bins" ? spec.query.grouping.count : null)}.`
          : "Each bar represents one exact involvement count."}{" "}
        Height is the number of events. The active filtered OCEL is used.
      </Text>
    </Stack>
  ),
  isEmpty: (data) => data.meta.total === 0,
  note: distributionNote("events"),
  chart: distributionChart("Events"),
});

export const timeBetweenActivities = defineCard<
  "time-between-activities",
  TimeBetweenData
>("time-between-activities", {
  title: (spec) => spec.title || "Time between activities",
  subtitle: (spec) =>
    `${spec.query.source_activity} → ${spec.query.target_activity} · ${spec.query.object_type} · ${spec.query.unit}`,
  filename: "time-between-activities",
  emptyMessage:
    "No consecutive source-to-target pairs are available in the active OCEL.",
  info: (spec) => (
    <Stack gap="xs">
      <Text size="sm">
        Shows elapsed time from “{spec.query.source_activity}” to “
        {spec.query.target_activity}” in object traces of type “
        {spec.query.object_type}”.
      </Text>
      <Text size="sm">
        Each object trace is first filtered to the two selected activities. A
        duration is measured whenever a target directly follows a source in that
        filtered trace, so unrelated activities may occur between them in the
        original trace.
      </Text>
      <Text size="sm">
        One object can contribute multiple pairs. Duplicate event–object
        relations are removed. The active filtered OCEL is used.
      </Text>
    </Stack>
  ),
  isEmpty: (data) => data.meta.total === 0,
  note: (data) => (
    <Pair
      left={`${data.meta.pair_count.toLocaleString()} matched pairs`}
      right={`${data.meta.contributing_object_count.toLocaleString()} contributing objects`}
    />
  ),
  chart: (data, _spec, slot) => (
    <DistributionChart
      buckets={data?.rows ?? []}
      visualization="histogram"
      seriesName="Activity pairs"
      {...slot}
    />
  ),
});

export const activityExecutionFrequency = defineCard<
  "activity-execution-frequency",
  ExecutionFrequencyData
>("activity-execution-frequency", {
  title: (spec) => spec.title || "Activity execution frequency",
  subtitle: (spec) => `Object type · ${spec.query.object_type}`,
  filename: "activity-execution-frequency",
  emptyMessage:
    "No matching event–object pairs are available in the active OCEL.",
  info: (spec) => (
    <Stack gap="xs">
      <Text size="sm">
        Shows how many objects of type “{spec.query.object_type}” executed each
        activity a given number of times across their complete lifecycle.
      </Text>
      <Text size="sm">
        Every object appears exactly once per activity. Execution counts are
        grouped into bounded ranges such as 1, 2, 3–5, and 6–10; high-frequency
        resources therefore do not create unbounded chart layers.
      </Text>
      <Text size="sm">
        Percentages are relative to all objects that executed the activity. The
        active filtered OCEL is used.
      </Text>
    </Stack>
  ),
  note: (data) => (
    <Pair
      left={`${data.meta.object_count.toLocaleString()} objects · ${data.meta.object_activity_pair_count.toLocaleString()} object–activity pairs`}
      right={`Maximum ${data.meta.maximum_execution_count.toLocaleString()} executions`}
    />
  ),
  chart: (data, _spec, slot) => {
    const rows: Row[] = (data?.rows ?? []).map((row) => ({
      activity: row.activity,
      executions:
        row.band === "1"
          ? "Executed once"
          : row.band === "2"
            ? "Executed twice"
            : `Executed ${row.band} times`,
      objects: row.object_count,
    }));
    const activities = new Set(rows.map((row) => row.activity)).size;
    return (
      <Chart
        type="bar"
        rows={rows}
        {...slot}
        x="activity"
        y="objects"
        series="executions"
        stack
        xAxis={{ name: "Activity" }}
        yAxis={{ name: "Objects", minInterval: 1 }}
        tooltip={{ showTotal: true, showPercent: true, totalLabel: "Objects" }}
        {...(activities > 8
          ? { zoom: { axis: "x" as const, slider: true, mouse: true } }
          : {})}
      />
    );
  },
});

export const objectTypeCombinations = defineCard<
  "object-type-combinations",
  TypeCombinationsData
>("object-type-combinations", {
  title: (spec) => spec.title || "Object-type combinations per event",
  subtitle: (spec) => {
    const selected = spec.query.activities ?? [];
    const scope =
      selected.length === 1
        ? selected[0]
        : selected.length > 1
          ? `${selected.length} activities`
          : "All activities";
    return `${scope} · Top ${spec.query.limit ?? 15} combinations`;
  },
  filename: "object-type-combinations",
  emptyMessage: "No events are available in the active OCEL.",
  info: (spec) => (
    <Stack gap="xs">
      <Text size="sm">
        Each bar represents the exact set of object types present in an event.
        Events are counted once and split by activity.
      </Text>
      <Text size="sm">
        Repeated objects of the same type do not change the combination.
        {(spec.query.activities ?? []).length === 1
          ? " Percentages use all events of the selected activity as their denominator."
          : " Percentages show each activity's share of all events with that exact combination."}
      </Text>
      <Text size="sm">
        Only the most frequent combinations are shown. The active filtered OCEL
        is used.
      </Text>
    </Stack>
  ),
  note: (data) => (
    <Pair
      left={`${data.meta.total_event_count.toLocaleString()} events shown`}
      right={`${new Set(data.rows.map((row) => combinationLabel(row.object_types))).size} of ${data.meta.total_combination_count.toLocaleString()} combinations`}
    />
  ),
  chart: (data, spec, slot) => {
    const rows: Row[] = (data?.rows ?? []).map((row) => ({
      combination: combinationLabel(row.object_types),
      activity: row.activity,
      events: row.event_count,
    }));
    const combinations = new Set(rows.map((row) => row.combination)).size;
    const singleActivity = (spec.query.activities ?? []).length === 1;
    return (
      <Chart
        type="bar"
        rows={rows}
        {...slot}
        x="combination"
        y="events"
        series="activity"
        stack
        orientation="horizontal"
        legend={false}
        xAxis={{ name: "Object types", maxLabelWidth: 132 }}
        yAxis={{ name: "Events", minInterval: 1 }}
        tooltip={{
          showTotal: true,
          totalLabel: "Events",
          // One activity is compared against its own event total; several are
          // compared against the combination they share.
          showPercent: singleActivity
            ? (data?.meta.total_event_count ?? true)
            : true,
        }}
        {...(combinations > 8
          ? { zoom: { axis: "y" as const, slider: true, mouse: true } }
          : {})}
      />
    );
  },
});

export const objectCountsPerEvent = defineCard<
  "object-counts-per-event",
  CountsPerEventData
>("object-counts-per-event", {
  title: (spec) => spec.title || "Objects involved per event",
  subtitle: (spec) =>
    spec.query.activities?.length
      ? `${spec.query.activities.length} selected activities`
      : "All activities",
  filename: "objects-involved-per-event",
  emptyMessage:
    "No matching event–object relations are available in the active OCEL.",
  info: () => (
    <Stack gap="xs">
      <Text size="sm">
        Shows how many distinct objects of each type participate in an event.
        The hierarchy is activity → object type → number of objects.
      </Text>
      <Text size="sm">
        Duplicate event–object relations are counted once. Segment size is the
        number of events having exactly that object count for the activity and
        object type. Because object-type populations overlap, the activity ring
        is structural; its hover value reports unique events instead of summing
        its object-type children. Object-type percentages use the activity's
        unique events as their denominator; count percentages use the
        corresponding object type.
      </Text>
      <Text size="sm">The active filtered OCEL is used.</Text>
    </Stack>
  ),
  note: (data) => (
    <Pair
      left={`${Object.values(data.meta.activity_event_counts)
        .reduce((sum, count) => sum + count, 0)
        .toLocaleString()} unique events`}
      right="Click a segment to focus"
    />
  ),
  chart: (data, _spec, slot) => (
    <Chart
      type="sunburst"
      rows={countsPerEventRows(data)}
      {...slot}
      path={["activity", "object_type", "objects"]}
      sort="none"
      value="events"
      nodeValue={["unique_events", null, null]}
    />
  ),
});

export const objectActivityExecutionDistribution = defineCard<
  "object-activity-execution-distribution",
  ExecutionDistributionData
>("object-activity-execution-distribution", {
  title: (spec) => spec.title || "Object activity execution frequency",
  subtitle: (spec) => `Object type · ${spec.query.object_type}`,
  filename: "object-activity-execution-frequency",
  emptyMessage: "No activities with variable execution counts are available.",
  info: () => (
    <Stack gap="xs">
      <Text size="sm">
        Inner ring: activity. Outer ring: exact number of executions across each
        object's full lifecycle.
      </Text>
      <Text size="sm">
        Segment size is the number of objects with that execution count.
        Activities where every participating object executed exactly once are
        omitted. Duplicate event–object relations are removed.
      </Text>
      <Text size="sm">The active filtered OCEL is used.</Text>
    </Stack>
  ),
  note: (data) => (
    <Pair
      left={`${data.meta.activity_count} activities`}
      right={`${data.meta.object_count.toLocaleString()} objects`}
    />
  ),
  chart: (data, _spec, slot) => (
    <Chart
      type="sunburst"
      rows={(data?.rows ?? []).map((row) => ({
        activity: row.activity,
        executions: `${row.execution_count} execution${row.execution_count === 1 ? "" : "s"}`,
        objects: row.object_count,
      }))}
      {...slot}
      path={["activity", "executions"]}
      sort="none"
      value="objects"
    />
  ),
});

export const totalObjectInvolvement = defineCard<
  "total-object-involvement",
  TotalInvolvementData
>("total-object-involvement", {
  title: (spec) => spec.title || "Total objects involved in events",
  subtitle: () => "All object types",
  filename: "total-object-involvement",
  emptyMessage: "No events are available in the active OCEL.",
  info: () => (
    <Stack gap="xs">
      <Text size="sm">
        Shows the distribution of the total number of distinct objects involved
        in each event, regardless of object type.
      </Text>
      <Text size="sm">
        The x-axis is the object count, height is the number of events, and
        colour is the activity. Every event is counted once and duplicate
        event–object relations are removed.
      </Text>
      <Text size="sm">
        Events without an object relation appear at zero. The active filtered
        OCEL is used.
      </Text>
    </Stack>
  ),
  note: (data) => (
    <Text size="xs" c="dimmed">
      {data.meta.event_count.toLocaleString()} unique events
    </Text>
  ),
  chart: (data, _spec, slot) => (
    <Chart
      type="bar"
      rows={(data?.rows ?? []).map((row) => ({
        objects: row.object_count,
        activity: row.activity,
        events: row.event_count,
      }))}
      {...slot}
      x="objects"
      y="events"
      series="activity"
      stack
      sort="category"
      xAxis={{
        type: "value",
        name: "Distinct objects involved",
        minInterval: 1,
        min: 0,
      }}
      yAxis={{ name: "Events", minInterval: 1 }}
      tooltip={{ showTotal: true, showPercent: true, totalLabel: "Events" }}
      zoom={{ axis: "x", slider: true, mouse: true }}
    />
  ),
});

export const objectAttributeTimeline = defineCard<
  "object-attribute-timeline",
  TimelineData
>("object-attribute-timeline", {
  title: (spec) => spec.title || "Object attribute value development",
  subtitle: (spec) => `Object · ${spec.query.object_id}`,
  filename: "object-attribute-timeline",
  emptyMessage: "This object's type has no attributes to plot.",
  info: () => (
    <Stack gap="xs">
      <Text size="sm">
        Shows how every attribute of the selected object's type changed over the
        object's lifetime, overlaid on one shared timeline of the object's own
        events (labelled by activity) and any timestamps where an attribute
        changed.
      </Text>
      <Text size="sm">
        Each attribute keeps its own y-axis (own scale/unit) and color; toggle a
        line via the legend to focus on it. Values are held constant between
        changes (a step line), matching the object's actual state at each point.
        The active filtered OCEL is used.
      </Text>
    </Stack>
  ),
  isEmpty: (data) => data.rows.length === 0,
  note: (data) => (
    <Text size="xs" c="dimmed">
      {data.meta.object_type} · {data.meta.attributes.length} attribute
      {data.meta.attributes.length === 1 ? "" : "s"} · {data.rows.length} points
    </Text>
  ),
  chart: (data, _spec, slot) => (
    <Chart
      type="timeline"
      rows={timelineRows(data)}
      {...slot}
      x="point"
      values={data?.meta.attributes ?? []}
    />
  ),
});

/* -------------------------------------------------------------------------- */
/* Row shaping the views share                                                */
/* -------------------------------------------------------------------------- */

function combinationLabel(objectTypes: string[]): string {
  return objectTypes.length > 0 ? objectTypes.join(" + ") : "No object types";
}

/**
 * `unique_events` carries the activity's own event count, because object-type
 * children overlap and must not be summed into it.
 */
function countsPerEventRows(data: CountsPerEventData | undefined): Row[] {
  if (!data) return [];
  return data.rows.map((row) => ({
    activity: row.activity,
    object_type: row.object_type,
    objects: `${row.object_count} object${row.object_count === 1 ? "" : "s"}`,
    events: row.event_count,
    unique_events: data.meta.activity_event_counts[row.activity] ?? 0,
  }));
}

/** Labels each point by its activity; booleans are plotted as 0 and 1. */
function timelineRows(data: TimelineData | undefined): Row[] {
  if (!data) return [];
  return data.rows.map((source, index) => {
    const row: Row = { point: source.activity ?? `#${index + 1}` };
    for (const attribute of data.meta.attributes) {
      const value = source.values[attribute];
      row[attribute] =
        typeof value === "boolean"
          ? Number(value)
          : typeof value === "string" || typeof value === "number"
            ? value
            : null;
    }
    return row;
  });
}
