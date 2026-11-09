import {
  Center,
  Group,
  Input,
  Loader,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import type { AttributeSummary } from "@ocelescope/api-base";
import { useAttributeSummary } from "./hooks";
import ObjectValueSelect from "./ObjectValueSelect";
import type { AttributeFilterProps, AttributeValueCondition } from "./types";
import { formatValue } from "./util";
import DateRangeView from "./views/DateRangeView";
import NumberRangeView from "./views/NumberRangeView";
import PatternView from "./views/PatternView";
import ValuePicker from "./views/ValuePicker";

type Kind = AttributeValueCondition["kind"];

const KIND_LABELS: Record<Kind, string> = {
  range: "Range",
  time_range: "Time range",
  values: "Values",
  pattern: "Pattern",
};

const kindsFor = (type: AttributeSummary["type"]): Kind[] => {
  switch (type) {
    case "int":
    case "float":
      return ["range", "values"];
    case "date":
      return ["time_range"];
    default:
      return ["values", "pattern"];
  }
};

const emptyCondition = (kind: Kind): AttributeValueCondition => {
  switch (kind) {
    case "range":
      return { kind, range: [null, null] };
    case "time_range":
      return { kind, range: [null, null] };
    case "values":
      return { kind, values: [] };
    case "pattern":
      return { kind, regex: "" };
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

const AttributeFilter: React.FC<AttributeFilterProps> = ({
  value,
  onChange,
  ...scope
}) => {
  const { entityType } = scope;
  const isObjects = entityType === "objects";
  const selected = value.value;
  const { data } = useAttributeSummary(scope, selected);
  const condition = value.condition ?? null;
  const inverted = value.negate ?? false;
  const kinds = data ? kindsFor(data.type) : [];
  const kind: Kind | undefined =
    condition && kinds.includes(condition.kind) ? condition.kind : kinds[0];

  const body = () => {
    if (data === undefined) {
      return (
        <Center flex={1} mih={120}>
          <Loader size="sm" />
        </Center>
      );
    }
    if (!data || data.count === 0) {
      return (
        <Text size="sm" c="dimmed">
          No {entityType} have a value for this attribute
          {isObjects ? " with the selected value" : ""}.
        </Text>
      );
    }
    const view = {
      ...scope,
      objectValue: selected,
      summary: data,
      value: condition,
      onChange: (next: AttributeValueCondition) =>
        onChange({ ...value, condition: next }),
      inverted,
    };
    switch (kind) {
      case "range":
        return <NumberRangeView {...view} />;
      case "time_range":
        return <DateRangeView {...view} />;
      case "pattern":
        return <PatternView {...view} />;
      default:
        return <ValuePicker {...view} />;
    }
  };

  return (
    <Stack gap="md" flex={1} mih={0}>
      <SimpleGrid cols={5}>
        <Stat label="Values" value={data?.count ?? "–"} />
        <Stat label="Missing" value={data?.missing ?? "–"} />
        <Stat label="Distinct" value={data?.distinct_values ?? "–"} />
        <Stat
          label="Min"
          value={data ? formatValue(data.min ?? null, data.type) : "–"}
        />
        <Stat
          label="Max"
          value={data ? formatValue(data.max ?? null, data.type) : "–"}
        />
      </SimpleGrid>
      <Group gap="lg" align="end">
        {isObjects && data?.dynamic && (
          <ObjectValueSelect
            value={selected}
            onChange={(next) => onChange({ ...value, value: next })}
          />
        )}
        {kinds.length > 1 && (
          <Input.Wrapper label="Condition" size="xs">
            <SegmentedControl
              size="xs"
              display="flex"
              data={kinds.map((option) => ({
                value: option,
                label: KIND_LABELS[option],
              }))}
              value={kind}
              onChange={(next) =>
                onChange({ ...value, condition: emptyCondition(next as Kind) })
              }
            />
          </Input.Wrapper>
        )}
        <Group gap="lg" ml="auto">
          <Switch
            size="sm"
            label="Include null"
            checked={(value.null ?? "include") === "include"}
            onChange={(event) =>
              onChange({
                ...value,
                null: event.currentTarget.checked ? "include" : "exclude",
              })
            }
          />
          <Switch
            size="sm"
            label="Negate"
            checked={inverted}
            onChange={(event) =>
              onChange({ ...value, negate: event.currentTarget.checked })
            }
          />
        </Group>
      </Group>
      {body()}
    </Stack>
  );
};

export default AttributeFilter;
