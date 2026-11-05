import {
  Badge,
  Center,
  Group,
  Loader,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import {
  type AttributeDistribution,
  useAttributeDistribution,
} from "@ocelescope/api-base";
import { keepPreviousData } from "@tanstack/react-query";
import {
  type ConditionProps,
  type FilterCondition,
  formatValue,
  type PreviewProps,
  scopeParams,
} from "./util";
import DateRangeView from "./views/RangeView/DateRangeView";
import NumberRangeView from "./views/RangeView/NumberRangeView";
import PatternView from "./views/ValuesView/PatternView";
import ValuePicker from "./views/ValuesView/ValuePicker";

const BINS = 40;

type Kind = FilterCondition["condition"]["kind"];

const KIND_LABELS: Record<NonNullable<Kind>, string> = {
  range: "Range",
  time_range: "Time range",
  values: "Values",
  pattern: "Pattern",
  null: "Missing",
};

const kindsFor = (type: AttributeDistribution["type"]): NonNullable<Kind>[] => {
  switch (type) {
    case "int":
    case "float":
      return ["range", "null"];
    case "date":
      return ["time_range", "null"];
    default:
      return ["values", "pattern", "null"];
  }
};

const emptyCondition = (
  kind: NonNullable<Kind>,
): FilterCondition["condition"] => {
  switch (kind) {
    case "range":
      return { kind, range: [null, null] };
    case "time_range":
      return { kind, range: [null, null] };
    case "values":
      return { kind, values: [] };
    case "pattern":
      return { kind, regex: "" };
    case "null":
      return { kind };
  }
};

const Stat: React.FC<{ label: string; value: string | number }> = ({
  label,
  value,
}) => (
  <Stack gap={0} miw={0}>
    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
      {label}
    </Text>
    <Text size="sm" fw={500} truncate>
      {typeof value === "number" ? value.toLocaleString() : value}
    </Text>
  </Stack>
);

const ConditionEditor: React.FC<ConditionProps & PreviewProps> = ({
  condition,
  onChange,
  ...preview
}) => {
  const { ocelId, entityType, ...scope } = preview;
  const distribution = useAttributeDistribution(
    ocelId,
    { ...scopeParams({ entityType, ...scope }), bins: BINS },
    { query: { placeholderData: keepPreviousData } },
  );
  const data = distribution.data;

  if (data === undefined) {
    return (
      <Center flex={1} mih={120}>
        <Loader size="sm" />
      </Center>
    );
  }

  if (!data) {
    return (
      <Text size="sm" c="dimmed">
        The attribute has no values in the log as the steps before leave it.
      </Text>
    );
  }

  const kind = condition.condition.kind ?? "null";
  const kinds = kindsFor(data.type);

  return (
    <Stack gap="md" flex={1} mih={0}>
      <Group justify="space-between" wrap="nowrap">
        <SegmentedControl
          size="xs"
          data={kinds.map((value) => ({ value, label: KIND_LABELS[value] }))}
          value={kinds.includes(kind) ? kind : kinds[0]}
          onChange={(next) =>
            onChange({
              ...condition,
              condition: emptyCondition(next as NonNullable<Kind>),
            })
          }
        />
        <Badge variant="light">{data.type}</Badge>
      </Group>
      <SimpleGrid cols={4}>
        <Stat label="Values" value={data.count} />
        <Stat label="Distinct" value={data.distinct_values} />
        <Stat label="Min" value={formatValue(data.min, data.type)} />
        <Stat label="Max" value={formatValue(data.max, data.type)} />
      </SimpleGrid>
      {kind === "null" ? (
        <Text size="sm" c="dimmed">
          Matches the {entityType} without a value (empty or none). Turn on
          Negate to match the {entityType} that have one.
        </Text>
      ) : kind === "range" ? (
        <NumberRangeView
          data={data}
          condition={condition}
          onChange={onChange}
        />
      ) : kind === "time_range" ? (
        <DateRangeView data={data} condition={condition} onChange={onChange} />
      ) : kind === "pattern" ? (
        <PatternView
          data={data}
          condition={condition}
          onChange={onChange}
          {...preview}
        />
      ) : (
        <ValuePicker
          data={data}
          condition={condition}
          onChange={onChange}
          {...preview}
        />
      )}
    </Stack>
  );
};

export default ConditionEditor;
