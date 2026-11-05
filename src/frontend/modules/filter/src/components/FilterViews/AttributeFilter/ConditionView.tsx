import {
  Button,
  Checkbox,
  Group,
  Select,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { ArrowLeftIcon, TrashIcon } from "lucide-react";
import type { ObjectAttributeCondition } from "../../../api/base";
import dayjs from "../../../util/dayjs";
import ConditionEditor from "./ConditionEditor";
import {
  conditionSummary,
  type FilterCondition,
  type PreviewProps,
} from "./util";

type ValueSelector = NonNullable<ObjectAttributeCondition["value"]>;

const VALUE_OPTIONS = [
  { value: "first", label: "First value" },
  { value: "initial", label: "Initial value" },
  { value: "last", label: "Last value" },
  { value: "at", label: "Value at a time" },
];

const PICKER_FORMAT = "YYYY-MM-DD HH:mm:ss";

const toSelector = (kind: string, previous?: ValueSelector): ValueSelector => {
  switch (kind) {
    case "initial":
      return { kind: "initial" };
    case "last":
      return { kind: "last" };
    case "at":
      return {
        kind: "at",
        timestamp:
          previous?.kind === "at"
            ? previous.timestamp
            : dayjs().format(PICKER_FORMAT),
      };
    default:
      return { kind: "first" };
  }
};

type ValueSelectProps = {
  value: ValueSelector | undefined;
  onChange: (value: ValueSelector) => void;
};

const ValueSelect: React.FC<ValueSelectProps> = ({ value, onChange }) => (
  <Group gap="sm" wrap="nowrap" align="end">
    <Select
      size="xs"
      w={180}
      label="Value"
      allowDeselect={false}
      data={VALUE_OPTIONS}
      value={value?.kind ?? "first"}
      onChange={(next) => next && onChange(toSelector(next, value))}
    />
    {value?.kind === "at" && (
      <DateTimePicker
        size="xs"
        withSeconds
        label="At"
        value={dayjs(value.timestamp).format(PICKER_FORMAT)}
        onChange={(next) =>
          next &&
          onChange({
            kind: "at",
            timestamp: dayjs(next).format(PICKER_FORMAT),
          })
        }
      />
    )}
  </Group>
);

type ConditionViewProps = PreviewProps & {
  condition: FilterCondition;
  onChange: (condition: FilterCondition) => void;
  onRemove: () => void;
  onBack: () => void;
};

const ConditionView: React.FC<ConditionViewProps> = ({
  condition,
  onChange,
  onRemove,
  onBack,
  ...preview
}) => (
  <Stack gap="md" flex={1} mih={0}>
    <Group justify="space-between" wrap="nowrap">
      <Group gap="sm" wrap="nowrap" miw={0}>
        <Button
          variant="subtle"
          size="compact-sm"
          leftSection={<ArrowLeftIcon size={14} />}
          onClick={onBack}
        >
          Back
        </Button>
        <Title order={5} style={{ overflowWrap: "anywhere" }}>
          {preview.attribute}
        </Title>
      </Group>
      <Button
        variant="light"
        color="red"
        size="compact-sm"
        leftSection={<TrashIcon size={14} />}
        onClick={onRemove}
      >
        Remove
      </Button>
    </Group>
    <Text size="sm" c="dimmed">
      {conditionSummary(preview.attribute, condition)}
    </Text>
    <Group gap="lg" align="end">
      {preview.entityType === "objects" && (
        <ValueSelect
          value={"value" in condition ? condition.value : undefined}
          onChange={(value) => onChange({ ...condition, value })}
        />
      )}
      <Switch
        size="sm"
        label="Negate"
        checked={condition.negate ?? false}
        onChange={(event) =>
          onChange({ ...condition, negate: event.currentTarget.checked })
        }
      />
      {condition.condition.kind !== "null" && (
        <Checkbox
          size="sm"
          label="Also match missing values"
          checked={condition.null ?? false}
          onChange={(event) =>
            onChange({ ...condition, null: event.currentTarget.checked })
          }
        />
      )}
    </Group>
    <ConditionEditor condition={condition} onChange={onChange} {...preview} />
  </Stack>
);

export default ConditionView;
