/**
 * The analyses this module offers: for each one, the SQL that answers it and
 * how to draw the answer.
 *
 * Everything lives here because everything an analysis is - its question, its
 * parameters, its query, its chart - fits on a screen. The queries run against
 * the OCEL's DuckDB tables (`events`, `objects`, `e2o`, `object_changes`)
 * through `OcelChart`, so there is no exploration backend to keep in step.
 */
import type { ChartOptions } from "@ocelescope/core";

export type Values = Record<
  string,
  string | number | readonly string[] | undefined
>;

export interface Param {
  name: string;
  label: string;
  kind:
    | "activity"
    | "activities"
    | "objectType"
    | "object"
    | "eventAttribute"
    | "objectAttribute"
    | "choice"
    | "number";
  /** Options for `choice`, first one being the default. */
  options?: readonly string[];
  default?: string | number | readonly string[];
  /** Optional controls narrow a result; leaving them empty means all. */
  required?: boolean;
  min?: number;
  max?: number;
}

export interface Analysis {
  id: string;
  label: string;
  category: "Behaviour" | "Relationships" | "Attributes" | "Time";
  /** The question the chart answers, shown under its title. */
  question: string;
  /** Plain-language provenance shown in the card's information popover. */
  method: string;
  params: readonly Param[];
  sql: (values: Values, numeric: Numeric) => string;
  chart: (values: Values) => ChartOptions;
  /** Drawn by r4pm's attribute-change viewer rather than by a chart. */
  view?: "attribute-changes";
}

/** Whether an attribute holds numbers, which decides bins versus value counts. */
export type Numeric = (attribute: string) => boolean;

const ident = (name: unknown) =>
  `"${String(name ?? "").replaceAll('"', '""')}"`;
const lit = (value: unknown) =>
  `'${String(value ?? "").replaceAll("'", "''")}'`;
const int = (value: unknown, fallback: number) =>
  Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
const list = (value: unknown) =>
  Array.isArray(value)
    ? value.map(String)
    : value == null
      ? []
      : [String(value)];
const activityFilter = (value: unknown, column = "activity") => {
  const selected = list(value);
  return selected.length === 0
    ? "TRUE"
    : `${column} IN (${selected.map(lit).join(", ")})`;
};

/** Every event-object relation, once, with its event and object described.
 * The joins drop relations whose event or object is missing from the log. */
const REL = `rel AS (
    SELECT DISTINCT r."ocel:eid" AS eid, r."ocel:oid" AS oid,
           e."ocel:activity" AS activity, e."ocel:timestamp" AS ts, o."ocel:type" AS type
    FROM e2o r JOIN events e USING ("ocel:eid") JOIN objects o USING ("ocel:oid")
  )`;

const SECONDS: Record<string, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86_400,
};

/**
 * Value counts, most frequent first, with the tail folded into one bar.
 *
 * `source` selects a single column named `value`, one row per member of the
 * population - so missing values can be counted rather than quietly dropped.
 */
const counts = (source: string, limit = 25) => `WITH raw AS (${source}),
  counted AS (
    SELECT value, count(*) AS count FROM raw WHERE value IS NOT NULL GROUP BY 1
  ),
  ranked AS (
    SELECT *, row_number() OVER (ORDER BY count DESC, value) AS rank FROM counted
  )
  SELECT CAST(value AS VARCHAR) AS bucket, count, rank FROM ranked WHERE rank <= ${limit}
  UNION ALL
  SELECT 'Other (' || count(*) || ')', sum(count), ${limit} + 1
  FROM ranked WHERE rank > ${limit} GROUP BY ALL HAVING count(*) > 0
  UNION ALL
  SELECT 'Missing', count(*), ${limit} + 2
  FROM raw WHERE value IS NULL GROUP BY ALL HAVING count(*) > 0
  ORDER BY rank`;

/**
 * A histogram of `source`'s `value` column.
 *
 * Bin width is Freedman-Diaconis (2·IQR/∛n), with Sturges' rule where the
 * interquartile range is zero. Values beyond Tukey's outer fences are counted
 * in a `<` and a `>` bar instead of stretching the bins, which is what left a
 * long-tailed distribution as one tall bar and a row of empty ones.
 */
const histogram = (source: string) => `WITH raw AS (${source}),
  spread AS (
    SELECT quantile_cont(value, 0.25) AS q1, quantile_cont(value, 0.75) AS q3 FROM raw
  ),
  kept AS (
    SELECT value FROM raw, spread
    WHERE q3 = q1 OR value BETWEEN q1 - 3 * (q3 - q1) AND q3 + 3 * (q3 - q1)
  ),
  shape AS (
    SELECT count(*) AS n, min(value) AS lo, max(value) AS hi,
           quantile_cont(value, 0.25) AS q1, quantile_cont(value, 0.75) AS q3
    FROM kept
  ),
  plan AS (
    SELECT n, lo, hi, (hi - lo) / bins AS width, bins FROM (
      SELECT *, least(200, greatest(1, ceil((hi - lo) / nullif(
          CASE WHEN q3 > q1 THEN 2 * (q3 - q1) / pow(n, 1.0 / 3)
               ELSE (hi - lo) / (ceil(log2(greatest(n, 2))) + 1) END, 0))::BIGINT)) AS bins
      FROM shape
    )
  ),
  binned AS (
    SELECT lo + width * least(floor((value - lo) / nullif(width, 0)), bins - 1) AS start, width
    FROM raw, plan WHERE value BETWEEN lo AND hi
  )
  SELECT format('{:.6g} – {:.6g}', start, start + width) AS bucket, count(*) AS count, start
  FROM binned GROUP BY ALL
  UNION ALL
  SELECT format('< {:.6g}', lo), count(*), -1e308 FROM raw, plan WHERE value < lo GROUP BY ALL
  UNION ALL
  SELECT format('> {:.6g}', hi), count(*), 1e308 FROM raw, plan WHERE value > hi GROUP BY ALL
  ORDER BY start`;

/** Value counts or a histogram, whichever the attribute deserves. */
const distribution = (source: string, isNumeric: boolean) =>
  isNumeric ? histogram(source) : counts(source);

const DISTRIBUTION_CHART = {
  x: "bucket",
  y: "count",
  types: ["bar", "pie"],
} as const satisfies ChartOptions;

export const analyses: readonly Analysis[] = [
  {
    id: "total-object-involvement",
    label: "Total objects per event",
    category: "Relationships",
    question:
      "How many distinct objects does an event involve, and which activities are the events of?",
    method:
      "Each event is joined to its unique event–object relations. Events are grouped by their number of distinct objects and activity; the bar height is the number of events in each group.",
    params: [],
    sql: () => `WITH per_event AS (
    SELECT e."ocel:activity" AS activity, count(DISTINCT o."ocel:oid") AS objects
    FROM events e
    LEFT JOIN e2o r USING ("ocel:eid")
    LEFT JOIN objects o USING ("ocel:oid")
    GROUP BY e."ocel:eid", e."ocel:activity"
  )
  SELECT objects, activity, count(*) AS events FROM per_event GROUP BY ALL ORDER BY objects`,
    chart: () => ({
      x: "objects",
      y: "events",
      series: "activity",
      stacked: true,
      colorScope: "activity",
    }),
  },
  {
    id: "object-counts-per-event",
    label: "Objects per type in an event",
    category: "Relationships",
    question:
      "How many distinct objects of each type take part in an event of an activity?",
    method:
      "Unique event–object relations are counted per event and object type. The rings show activity, object type, and the exact number of involved objects; segment size is the number of matching events.",
    params: [
      {
        name: "activities",
        label: "Activities",
        kind: "activities",
        required: false,
        default: [],
      },
    ],
    sql: ({ activities }) => `WITH ${REL},
  per_event AS (
    SELECT activity, type, eid, count(DISTINCT oid) AS objects
    FROM rel WHERE ${activityFilter(activities)} GROUP BY ALL
  )
  SELECT activity, type AS object_type, objects, count(*) AS events
  FROM per_event GROUP BY ALL ORDER BY ALL`,
    chart: () => ({
      type: "sunburst",
      types: ["sunburst", "bar"],
      path: ["activity", "object_type", "objects"],
      x: "object_type",
      y: "events",
      series: "objects",
    }),
  },
  {
    id: "object-type-combinations",
    label: "Object-type combinations",
    category: "Relationships",
    question:
      "Which exact sets of object types appear together in an event, and in which activities?",
    method:
      "For every event, duplicate relations are removed and the involved object types are sorted into an exact set. The most frequent sets become bars, split by the events' activities.",
    params: [
      {
        name: "activities",
        label: "Activities",
        kind: "activities",
        required: false,
        default: [],
      },
      {
        name: "limit",
        label: "Combinations",
        kind: "number",
        default: 15,
        min: 1,
        max: 50,
      },
    ],
    sql: ({ activities, limit }) => `WITH ${REL},
  sets AS (
    SELECT e."ocel:eid" AS eid, e."ocel:activity" AS activity,
           coalesce(list_sort(list(DISTINCT rel.type)), []::VARCHAR[]) AS types
    FROM events e LEFT JOIN rel ON rel.eid = e."ocel:eid"
    WHERE ${activityFilter(activities, 'e."ocel:activity"')}
    GROUP BY ALL
  ),
  ranked AS (
    SELECT types, row_number() OVER (ORDER BY count(*) DESC, types) AS rank
    FROM sets GROUP BY types
  )
  SELECT coalesce(nullif(array_to_string(types, ' + '), ''), 'no objects') AS combination,
         activity, count(*) AS events, rank
  FROM sets JOIN ranked USING (types)
  WHERE rank <= ${int(limit, 15)}
  GROUP BY ALL ORDER BY rank DESC`,
    chart: () => ({
      x: "combination",
      y: "events",
      series: "activity",
      stacked: true,
      horizontal: true,
      colorScope: "activity",
    }),
  },
  {
    id: "activity-execution-frequency",
    label: "Activity execution frequency",
    category: "Behaviour",
    question:
      "How many first, second, third, and later executions of each activity occur for objects of a type?",
    method:
      "Events are ranked chronologically within every object–activity pair. Each stacked layer counts event–object pairs at that execution number, revealing repeated activity executions directly.",
    params: [{ name: "object_type", label: "Object type", kind: "objectType" }],
    sql: ({ object_type }) => `WITH ${REL},
  ranked AS (
    SELECT oid, activity,
           row_number() OVER (PARTITION BY oid, activity ORDER BY ts, eid) AS execution
    FROM rel WHERE type = ${lit(object_type)}
  ),
  counted AS (
    SELECT activity, execution, count(*) AS pairs
    FROM ranked GROUP BY activity, execution
  )
  SELECT activity, CAST(execution AS VARCHAR) AS execution, pairs
  FROM counted ORDER BY counted.execution, activity`,
    chart: () => ({
      x: "activity",
      y: "pairs",
      series: "execution",
      stacked: true,
      colorScope: "execution",
    }),
  },
  {
    id: "object-activity-execution-distribution",
    label: "Execution counts per object",
    category: "Behaviour",
    question:
      "For activities that objects repeat, how many objects executed one exactly n times?",
    method:
      "Unique event–object relations are counted for each object and activity. Activities that never repeat are removed; ring size then represents the number of objects with each exact execution count.",
    params: [{ name: "object_type", label: "Object type", kind: "objectType" }],
    sql: ({ object_type }) => `WITH ${REL},
  executions AS (
    SELECT oid, activity, count(*) AS runs
    FROM rel WHERE type = ${lit(object_type)} GROUP BY ALL
  ),
  repeated AS (
    SELECT * FROM executions QUALIFY max(runs) OVER (PARTITION BY activity) > 1
  )
  SELECT activity, runs AS executions, count(*) AS objects
  FROM repeated GROUP BY ALL ORDER BY ALL`,
    chart: () => ({
      type: "sunburst",
      types: ["sunburst", "bar"],
      path: ["activity", "executions"],
      x: "executions",
      y: "objects",
      series: "activity",
      colorScope: "activity",
    }),
  },
  {
    id: "object-involvement-distribution",
    label: "Objects of one type per event",
    category: "Relationships",
    question:
      "Across the events of an activity, how much does the number of involved objects of a type vary?",
    method:
      "For each event of the selected activity, unique related objects of the selected type are counted—including zero. The chart shows the frequency of every resulting count.",
    params: [
      { name: "activity", label: "Activity", kind: "activity" },
      { name: "object_type", label: "Object type", kind: "objectType" },
    ],
    sql: ({ activity, object_type }) => `WITH ${REL},
  per_event AS (
    SELECT count(DISTINCT rel.oid) AS objects
    FROM events e
    LEFT JOIN rel ON rel.eid = e."ocel:eid" AND rel.type = ${lit(object_type)}
    WHERE e."ocel:activity" = ${lit(activity)}
    GROUP BY e."ocel:eid"
  )
  SELECT objects, count(*) AS events FROM per_event GROUP BY 1 ORDER BY 1`,
    chart: () => ({ x: "objects", y: "events", types: ["bar", "pie"] }),
  },
  {
    id: "event-attribute-distribution",
    label: "Event attribute distribution",
    category: "Attributes",
    question:
      "How are an attribute's values distributed over an activity's events?",
    method:
      "The selected attribute is read once per event of the chosen activity. Numeric values use robust histogram bins; categorical values use frequency counts. Missing values are retained explicitly.",
    params: [
      { name: "activity", label: "Activity", kind: "activity" },
      { name: "attribute", label: "Attribute", kind: "eventAttribute" },
    ],
    sql: ({ activity, attribute }, numeric) =>
      distribution(
        `SELECT ${ident(attribute)} AS value FROM events
       WHERE "ocel:activity" = ${lit(activity)}`,
        numeric(String(attribute)),
      ),
    chart: () => DISTRIBUTION_CHART,
  },
  {
    id: "object-attribute-distribution",
    label: "Object attribute distribution",
    category: "Attributes",
    question:
      "What values does an object attribute hold at the moments objects take part in an activity?",
    method:
      "For every matching event–object relation, the latest attribute change at or before the event is selected. Those point-in-time values are then binned or counted, with missing values retained.",
    params: [
      { name: "activity", label: "Activity", kind: "activity" },
      { name: "object_type", label: "Object type", kind: "objectType" },
      { name: "attribute", label: "Attribute", kind: "objectAttribute" },
    ],
    // The attribute's value at the event is its last change at or before the
    // event; a change with no value leaves the previous one standing.
    sql: ({ activity, object_type, attribute }, numeric) =>
      distribution(
        `WITH ${REL},
    changes AS (
      SELECT "ocel:oid" AS oid, "ocel:timestamp" AS ts, ${ident(attribute)} AS value
      FROM object_changes
      WHERE "ocel:field" = ${lit(attribute)} AND ${ident(attribute)} IS NOT NULL
    ),
    pairs AS (
      SELECT oid, ts FROM rel
      WHERE activity = ${lit(activity)} AND type = ${lit(object_type)}
    )
    SELECT changes.value FROM pairs
    ASOF LEFT JOIN changes ON pairs.oid = changes.oid AND pairs.ts >= changes.ts`,
        numeric(String(attribute)),
      ),
    chart: () => DISTRIBUTION_CHART,
  },
  {
    id: "time-between-activities",
    label: "Time between activities",
    category: "Time",
    question:
      "How long does an object take to get from one activity to the next one?",
    method:
      "Each object's events are ordered in time and reduced to the two selected activities. Durations are measured only where the source is directly followed by the target in that reduced trace, then robustly binned.",
    params: [
      { name: "source", label: "From", kind: "activity" },
      { name: "target", label: "To", kind: "activity" },
      {
        name: "object_type",
        label: "Object type (optional)",
        kind: "objectType",
        required: false,
      },
      {
        name: "unit",
        label: "Unit",
        kind: "choice",
        options: ["hours", "days", "minutes", "seconds"],
      },
    ],
    // Each object's trace is reduced to the two activities, so "directly
    // followed" means with none of the two in between.
    sql: ({ source, target, object_type, unit }) =>
      histogram(`WITH ${REL},
    trace AS (
      SELECT oid, activity, ts,
             lead(activity) OVER w AS next_activity, lead(ts) OVER w AS next_ts
      FROM rel
      WHERE ${object_type == null ? "TRUE" : `type = ${lit(object_type)}`}
        AND activity IN (${lit(source)}, ${lit(target)})
      WINDOW w AS (PARTITION BY oid ORDER BY ts, eid)
    )
    SELECT epoch(next_ts - ts) / ${SECONDS[String(unit)] ?? 3600} AS value
    FROM trace WHERE activity = ${lit(source)} AND next_activity = ${lit(target)}`),
    chart: ({ unit }) => ({
      x: "bucket",
      y: "count",
      types: ["bar", "pie"],
      title: `Time in ${unit ?? "hours"}`,
    }),
  },
  {
    id: "object-attribute-timeline",
    label: "Attribute development of one object",
    category: "Attributes",
    question: "How did one object's attributes change over its lifetime?",
    method:
      "The object's initial values and change records are ordered on one shared timeline. Each attribute is forward-held until its next change and receives its own y-axis so values with different scales remain legible.",
    params: [{ name: "object", label: "Object", kind: "object" }],
    // A change row carries its value in the column named by `ocel:field`;
    // unpivoting to text picks that one column without naming any of them.
    // A value an object was created with is stamped 1970, so it is pulled
    // forward to the object's first event rather than stretching the axis.
    sql: ({ object }) => `WITH text AS (
    SELECT "ocel:timestamp" AS time, "ocel:field" AS field,
           CAST(COLUMNS(* EXCLUDE ("ocel:oid", "ocel:timestamp", "ocel:field")) AS VARCHAR)
    FROM object_changes WHERE "ocel:oid" = ${lit(object)}
  ),
  born AS (
    SELECT min(e."ocel:timestamp") AS time FROM e2o r
    JOIN events e USING ("ocel:eid") WHERE r."ocel:oid" = ${lit(object)}
  )
  SELECT greatest(time, coalesce((SELECT time FROM born), time)) AS time, attribute, value
  FROM (
    UNPIVOT text ON COLUMNS(* EXCLUDE (time, field)) INTO NAME attribute VALUE value
  ) WHERE attribute = field ORDER BY time`,
    chart: () => ({}),
    view: "attribute-changes",
  },
];

export const findAnalysis = (id: string) =>
  analyses.find((analysis) => analysis.id === id);

/** Whether every required parameter has a value. */
export const isConfigured = (analysis: Analysis, values: Values) =>
  analysis.params.every(
    (param) => param.required === false || hasValue(values[param.name]),
  );

const hasValue = (value: Values[string]) =>
  value != null && (!Array.isArray(value) || value.length > 0);
