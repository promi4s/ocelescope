import {
  Box,
  Collapse,
  Group,
  Input,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { ChevronDownIcon } from "lucide-react";
import dynamic from "next/dynamic";
import type { OcelSelectProps } from "../../types";

const R4PMFrequencyPicker = dynamic(
  () => import("@r4pm/components").then((m) => m.FrequencyPicker),
  { ssr: false },
);

export const FrequencyPicker = ({
  isMulti,
  value,
  onChange,
  items,
  ocelId,
  disabled,
  ...props
}: OcelSelectProps & { items: Record<string, number> }) => {
  const [opened, { toggle }] = useDisclosure(true);
  const isDisabled = disabled || !ocelId;
  const expanded = opened && !isDisabled;

  const selected = new Set<string>(
    isMulti ? (value ?? []) : value != null ? [value] : [],
  );

  const summary = !ocelId
    ? "Select an OCEL first"
    : selected.size === 0
      ? "Nothing selected"
      : isMulti
        ? `${selected.size} of ${Object.keys(items).length} selected`
        : [...selected][0];

  return (
    <Input.Wrapper {...props}>
      <UnstyledButton
        onClick={toggle}
        w="100%"
        py={4}
        disabled={isDisabled}
        style={{
          cursor: isDisabled ? "not-allowed" : undefined,
          opacity: isDisabled ? 0.6 : undefined,
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" c="dimmed" truncate>
            {summary}
          </Text>
          <ChevronDownIcon
            size={16}
            style={{
              transform: expanded ? "rotate(180deg)" : undefined,
              transition: "transform 150ms",
            }}
          />
        </Group>
      </UnstyledButton>
      <Collapse expanded={expanded}>
        <Box py="xs" mah={300} style={{ overflow: "hidden" }}>
          <R4PMFrequencyPicker
            value={selected}
            onChange={(next) =>
              onChange(
                isMulti
                  ? Array.from(next)
                  : (next.values().next().value ?? null),
              )
            }
            items={items}
            mode={isMulti ? "multi" : "single"}
          />
        </Box>
      </Collapse>
    </Input.Wrapper>
  );
};
