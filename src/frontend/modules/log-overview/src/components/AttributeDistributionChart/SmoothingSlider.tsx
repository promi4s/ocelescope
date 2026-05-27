import { Group, Slider, Stack, Text } from "@mantine/core";

interface Props {
  value: number;
  onChange: (v: number) => void;
}

export function SmoothingSlider({ value, onChange }: Props) {
  return (
    <Stack gap={6} w={220}>
      <Group justify="space-between" gap={4}>
        <Text size="xs" fw={500}>
          Smoothing
        </Text>
        <Text size="xs" c="dimmed">
          {value.toFixed(1)}
        </Text>
      </Group>
      <Slider
        value={value}
        onChange={onChange}
        min={0.1}
        max={5}
        step={0.1}
        marks={[{ value: 1, label: "1" }]}
        label={(v) => v.toFixed(1)}
        size="sm"
      />
    </Stack>
  );
}
