/** One analysis on the dashboard: its parameters, and the chart they produce. */
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Code,
  Divider,
  Group,
  HoverCard,
  Modal,
  MultiSelect,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { LineChart, OcelChart, useOcelQuery } from "@ocelescope/core";
import {
  AsyncBoundary,
  colorForKey,
  EmptyState,
  ViewerExportFrame,
} from "@r4pm/components";
import {
  ChartNoAxesCombinedIcon,
  InfoIcon,
  Settings2Icon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import {
  type Analysis,
  isConfigured,
  type Param,
  type Values,
} from "./analyses";
import { Control, useNumeric } from "./Controls";

export const AnalysisCard = ({
  analysis,
  values,
  onChange,
  onRemove,
  configurationOpened,
  onConfigure,
  onCloseConfiguration,
}: {
  analysis: Analysis;
  values: Values;
  onChange: (values: Values) => void;
  onRemove: () => void;
  configurationOpened: boolean;
  onConfigure: () => void;
  onCloseConfiguration: () => void;
}) => {
  const numeric = useNumeric(values);
  const configured = isConfigured(analysis, values);
  const setParam = (param: Param, value: Values[string]) => {
    const next = { ...values, [param.name]: value };
    // A previously selected attribute may not exist in the new parent scope.
    if (param.name === "activity" && param.kind === "activity") {
      const dependent = analysis.params.find(
        (candidate) => candidate.kind === "eventAttribute",
      );
      if (dependent) next[dependent.name] = undefined;
    }
    if (param.name === "object_type") {
      const dependent = analysis.params.find(
        (candidate) => candidate.kind === "objectAttribute",
      );
      if (dependent) next[dependent.name] = undefined;
    }
    onChange(next);
  };

  return (
    <>
      <Paper withBorder p="md" radius="lg">
        <Group
          align="flex-start"
          justify="space-between"
          gap="md"
          wrap="nowrap"
        >
          <Group align="flex-start" gap="sm" wrap="nowrap">
            <ThemeIcon variant="light" color="gray" radius="md" mt={1}>
              <ChartNoAxesCombinedIcon size={17} />
            </ThemeIcon>
            <Stack gap={4}>
              <Group gap="xs">
                <Text fw={600} size="sm">
                  {analysis.label}
                </Text>
                <Badge variant="light" color="gray" size="xs">
                  {analysis.category}
                </Badge>
                {!configured && (
                  <Badge variant="light" color="orange" size="xs">
                    Configure first
                  </Badge>
                )}
              </Group>
              <Text c="dimmed" size="xs" lineClamp={2}>
                {analysis.question}
              </Text>
              {configured && analysis.params.length > 0 && (
                <Group gap={4}>{summary(analysis, values)}</Group>
              )}
            </Stack>
          </Group>
          <Group gap={4} wrap="nowrap" data-export-ignore>
            <HoverCard
              width={340}
              shadow="md"
              position="bottom-end"
              openDelay={200}
            >
              <HoverCard.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label={`About ${analysis.label}`}
                >
                  <InfoIcon size={16} />
                </ActionIcon>
              </HoverCard.Target>
              <HoverCard.Dropdown>
                <Stack gap="xs">
                  <Text fw={600} size="sm">
                    What this shows
                  </Text>
                  <Text size="sm">{analysis.question}</Text>
                  <Divider />
                  <Text fw={600} size="sm">
                    How it is calculated
                  </Text>
                  <Text size="sm" c="dimmed">
                    {analysis.method}
                  </Text>
                </Stack>
              </HoverCard.Dropdown>
            </HoverCard>
            {analysis.params.length > 0 && (
              <Tooltip label="Configure">
                <ActionIcon
                  variant={configured ? "subtle" : "light"}
                  color={configured ? "gray" : "blue"}
                  aria-label={`Configure ${analysis.label}`}
                  onClick={onConfigure}
                >
                  <Settings2Icon size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label="Remove">
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={`Remove ${analysis.label}`}
                onClick={onRemove}
              >
                <Trash2Icon size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <ViewerExportFrame
          filename={analysis.id}
          style={{ height: 340, marginTop: 12 }}
        >
          {configured ? (
            analysis.view === "attribute-changes" ? (
              <Changes analysis={analysis} values={values} />
            ) : (
              <OcelChart
                height="100%"
                sql={analysis.sql(values, numeric)}
                {...analysis.chart(values)}
              />
            )
          ) : (
            <EmptyState
              title="Choose what to analyze"
              description={`Configure ${unset(analysis, values)} to create this visualization.`}
            />
          )}
        </ViewerExportFrame>
      </Paper>

      <Modal
        opened={configurationOpened}
        onClose={onCloseConfiguration}
        title={`Configure ${analysis.label}`}
        size="lg"
        centered
      >
        <Stack gap="md">
          <Divider />
          <ScrollArea.Autosize mah="62vh" type="auto" offsetScrollbars>
            <Stack gap="md" pr="xs">
              {analysis.view === "custom-chart" ? (
                <CustomChartControls values={values} onChange={onChange} />
              ) : (
                analysis.params.map((param) => (
                  <Control
                    key={param.name}
                    param={param}
                    values={values}
                    onChange={(value) => setParam(param, value)}
                  />
                ))
              )}
            </Stack>
          </ScrollArea.Autosize>
          <Group justify="space-between">
            <Text size="xs" c={configured ? "teal" : "dimmed"}>
              {configured
                ? "Ready—the visualization is updating with these choices."
                : `Still needed: ${unset(analysis, values)}.`}
            </Text>
            <Button onClick={onCloseConfiguration}>Done</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};

/** The parameters still without a value, in words. */
const unset = (analysis: Analysis, values: Values) =>
  analysis.params
    .filter(
      (param) => param.required !== false && !hasValue(values[param.name]),
    )
    .map((param) => param.label.toLowerCase())
    .join(", ");

const hasValue = (value: Values[string]) =>
  value != null && (!Array.isArray(value) || value.length > 0);

const summary = (analysis: Analysis, values: Values) =>
  analysis.params
    .filter((param) => param.kind !== "sql" && values[param.name] != null)
    .slice(0, 3)
    .map((param) => {
      const value = values[param.name];
      const text = Array.isArray(value)
        ? value.length === 0
          ? "All"
          : value.length <= 2
            ? value.join(", ")
            : `${value.length} selected`
        : String(value);
      return (
        <Badge key={param.name} variant="outline" color="gray" size="xs">
          {param.label}: {text}
        </Badge>
      );
    });

const PLOT_TYPES = ["bar", "line", "area", "scatter", "pie"];

const CustomChartControls = ({
  values,
  onChange,
}: {
  values: Values;
  onChange: (values: Values) => void;
}) => {
  const appliedSql = String(values.sql ?? "");
  const [draftSql, setDraftSql] = useState(appliedSql);
  const query = useOcelQuery({
    sql: appliedSql,
    enabled: appliedSql.trim().length > 0,
  });
  const columns = (query.data?.columns ?? []).map((column) => ({
    value: column.name,
    label: `${column.name} · ${column.type.toLowerCase()}`,
  }));
  const y = Array.isArray(values.y)
    ? values.y.map(String)
    : values.y == null
      ? []
      : [String(values.y)];

  const applyQuery = () => {
    const sql = draftSql.trim();
    if (sql === appliedSql) {
      void query.refetch();
      return;
    }
    onChange({
      ...values,
      sql,
      x: undefined,
      y: undefined,
      series: undefined,
    });
  };

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Textarea
          label="SQL query"
          description={
            <span>
              Available tables: <Code>events</Code>, <Code>objects</Code>,{" "}
              <Code>e2o</Code>, <Code>o2o</Code>, and{" "}
              <Code>object_changes</Code>.
            </span>
          }
          placeholder={
            'SELECT "ocel:activity" AS activity, count(*) AS events\nFROM events\nGROUP BY 1'
          }
          autosize
          minRows={6}
          maxRows={14}
          value={draftSql}
          onChange={(event) => setDraftSql(event.currentTarget.value)}
          styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
        />
        <Group justify="flex-end">
          <Button
            size="xs"
            variant="light"
            loading={query.isFetching}
            disabled={draftSql.trim().length === 0}
            onClick={applyQuery}
          >
            {columns.length > 0 ? "Reload columns" : "Load columns"}
          </Button>
        </Group>
      </Stack>

      {query.isError && (
        <Alert color="red" title="The query could not be loaded">
          {query.error instanceof Error
            ? query.error.message
            : "Check the SQL statement and try again."}
        </Alert>
      )}

      {columns.length > 0 && (
        <>
          <Divider label="Plot" labelPosition="left" />
          <Select
            label="Plot type"
            data={PLOT_TYPES}
            value={String(values.plot_type ?? "bar")}
            allowDeselect={false}
            onChange={(plot_type) =>
              onChange({ ...values, plot_type: plot_type ?? "bar" })
            }
          />
          <Group grow align="flex-start">
            <Select
              label="X axis"
              data={columns}
              value={values.x == null ? null : String(values.x)}
              onChange={(x) => onChange({ ...values, x: x ?? undefined })}
            />
            <MultiSelect
              label="Y axis"
              data={columns}
              value={y}
              searchable
              onChange={(next) => onChange({ ...values, y: next })}
            />
          </Group>
          <Select
            label="Series (optional)"
            description="Split rows into one trace per distinct value."
            data={columns}
            value={values.series == null ? null : String(values.series)}
            clearable
            searchable
            onChange={(series) =>
              onChange({ ...values, series: series ?? undefined })
            }
          />
          {values.plot_type === "bar" && (
            <Select
              label="Bar mode"
              data={["grouped", "stacked"]}
              value={String(values.bar_mode ?? "grouped")}
              allowDeselect={false}
              onChange={(bar_mode) =>
                onChange({ ...values, bar_mode: bar_mode ?? "grouped" })
              }
            />
          )}
          {values.plot_type === "line" && (
            <Select
              label="Y-axis mode"
              data={[
                { value: "shared", label: "Shared scale" },
                { value: "independent", label: "One scale per line" },
              ]}
              value={String(values.axis_mode ?? "shared")}
              allowDeselect={false}
              onChange={(axis_mode) =>
                onChange({ ...values, axis_mode: axis_mode ?? "shared" })
              }
            />
          )}
        </>
      )}
    </Stack>
  );
};

/**
 * How one object's attributes changed. Every attribute keeps its own scale,
 * but all lines share the timeline and hover in one plot.
 */
const Changes = ({
  analysis,
  values,
}: {
  analysis: Analysis;
  values: Values;
}) => {
  const query = useOcelQuery({ sql: analysis.sql(values, () => false) });

  return (
    <AsyncBoundary
      status={query}
      isEmpty={(result) => result.rows.length === 0}
      loadingLabel="Querying the OCEL…"
      errorTitle="The query failed"
      emptyState={{
        title: "No changes",
        description: "This object's attributes never change.",
      }}
      onRetry={() => void query.refetch()}
    >
      {(result) => {
        const rows = result.rows as Array<{
          time: string;
          attribute: string;
          value: string;
        }>;
        // Every attribute is drawn against the object's whole lifetime, so
        // the charts line up and a single reading keeps its place in time.
        const times = rows.map((row) => row.time).sort();
        const lifetime = [times[0], times[times.length - 1]] as const;

        return (
          <LineChart
            rows={rows}
            x="time"
            y="value"
            series="attribute"
            xRange={lifetime}
            yAxes="independent"
            colorOf={(attribute) =>
              colorForKey("attribute", attribute) ?? "#888888"
            }
            step
          />
        );
      }}
    </AsyncBoundary>
  );
};
