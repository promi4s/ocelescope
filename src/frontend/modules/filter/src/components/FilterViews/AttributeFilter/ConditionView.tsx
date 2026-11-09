import { Button, Group, Stack, Title } from "@mantine/core";
import { ArrowLeftIcon, TrashIcon } from "lucide-react";
import {
  AttributeFilter,
  type AttributeFilterValue,
  type AttributeScope,
} from "../../AttributeFilter";
import type { FilterCondition } from "./util";

type ConditionViewProps = AttributeScope & {
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
  ...scope
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
          {scope.attribute}
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
    <AttributeFilter
      {...scope}
      value={condition as AttributeFilterValue}
      onChange={(next) => onChange({ ...condition, ...next })}
    />
  </Stack>
);

export default ConditionView;
