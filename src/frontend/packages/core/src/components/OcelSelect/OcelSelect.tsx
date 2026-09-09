import {
  Box,
  Center,
  Group,
  Select,
  type SelectProps,
  Tooltip,
  useMantineTheme,
} from "@mantine/core";
import { useGetOcels } from "@ocelescope/api-base";
import { CheckIcon, FilterIcon } from "lucide-react";
import { type ComponentProps, useCallback, useMemo } from "react";
import { useCurrentOcel } from "../../hooks/useCurrentOCEL";

const iconProps = {
  color: "currentColor",
  opacity: 0.6,
  size: 18,
};

const OCELFilterIcon = ({ size }: { size: number }) => {
  const theme = useMantineTheme();
  return (
    <Tooltip label="A filter is applied to this log">
      <FilterIcon size={size} color={theme.colors.blue[8]} />
    </Tooltip>
  );
};

export const OcelSelect = ({
  value,
  ...props
}: Omit<ComponentProps<typeof Select<string>>, "data">) => {
  const { data: ocels } = useGetOcels();

  const ocelIds = useMemo(
    () =>
      (ocels ?? []).map(({ id, name }) => ({
        value: id,
        label: name,
      })),
    [ocels],
  );

  const filteredOcelIds = useMemo(
    () =>
      (ocels ?? [])
        .filter(({ filter_applied }) => filter_applied)
        .map(({ id }) => id),
    [ocels],
  );

  const renderSelectOption: SelectProps["renderOption"] = useCallback(
    ({ option, checked }) => (
      <Group flex="1" gap="xs" wrap="nowrap" style={{ overflow: "hidden" }}>
        {filteredOcelIds.includes(option.value) && (
          <Center style={{ flexShrink: 0 }}>
            <OCELFilterIcon size={14} />
          </Center>
        )}
        <Box
          flex="1"
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {option.label}
        </Box>
        {checked && (
          <Center style={{ flexShrink: 0 }}>
            <CheckIcon {...iconProps} />
          </Center>
        )}
      </Group>
    ),
    [filteredOcelIds],
  );

  return (
    <Select
      leftSection={
        value && filteredOcelIds.includes(value) ? (
          <OCELFilterIcon size={14} />
        ) : undefined
      }
      data={ocelIds}
      value={value}
      scrollAreaProps={{ styles: { content: { minWidth: 0 } } }}
      {...props}
      renderOption={renderSelectOption}
    />
  );
};

export const CurrentOcelSelect: React.FC = () => {
  const { id, setCurrentOcel } = useCurrentOcel();

  return (
    <OcelSelect
      value={id}
      w={250}
      onChange={(id) => {
        if (id) {
          setCurrentOcel(id);
        }
      }}
    />
  );
};
