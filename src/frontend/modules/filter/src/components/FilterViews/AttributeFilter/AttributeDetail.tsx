import {
  Badge,
  Button,
  Group,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { keepPreviousData } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { memo } from "react";
import { usePreviewAttributeDistribution } from "../../../api/base";
import type { NativeFilter } from "../../../types/filter";
import Previewed from "../../Previewed";
import { type AttributeFilter, type FieldProps, formatValue } from "./util";
import DateRangeView from "./views/RangeView/DateRangeView";
import NumberRangeView from "./views/RangeView/NumberRangeView";
import ValuesView from "./views/ValuesView/ValuesView";

const ALL_TYPES = "__all__";

const MODE_OPTIONS = [
  { label: "Include", value: "include" },
  { label: "Exclude", value: "exclude" },
];
const BINS = 40;

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

type AttributeDetailProps = FieldProps & {
  ocelId: string;
  entityType: "events" | "objects";
  before: NativeFilter[];
  scopes: string[];
  onClear: () => void;
};

const AttributeDetail: React.FC<AttributeDetailProps> = memo(
  ({ ocelId, entityType, filter, onChange, before, scopes, onClear }) => {
    const distribution = usePreviewAttributeDistribution(
      ocelId,
      before,
      {
        attribute: filter.attribute,
        entity_type: entityType,
        entity_names: filter.target_type ? [filter.target_type] : undefined,
        bins: BINS,
      },
      { query: { placeholderData: keepPreviousData } },
    );

    const typeNoun = entityType === "events" ? "activities" : "object types";

    return (
      <Stack gap="md" flex={1} mih={0}>
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" miw={0}>
            <Button
              variant="subtle"
              size="compact-sm"
              leftSection={<ArrowLeftIcon size={14} />}
              onClick={onClear}
            >
              Change attribute
            </Button>
            <Title order={5} style={{ overflowWrap: "anywhere" }}>
              {filter.attribute}
            </Title>
            {distribution.data && (
              <Badge variant="light">{distribution.data.type}</Badge>
            )}
          </Group>
          <Group gap="sm" wrap="nowrap">
            <SegmentedControl
              size="xs"
              data={MODE_OPTIONS}
              value={filter.mode ?? "include"}
              onChange={(next) =>
                onChange({ ...filter, mode: next as AttributeFilter["mode"] })
              }
            />
            {scopes.length > 1 ? (
              <Select
                size="xs"
                w={220}
                allowDeselect={false}
                value={filter.target_type ?? ALL_TYPES}
                data={[
                  { value: ALL_TYPES, label: `All ${typeNoun}` },
                  ...scopes.map((scope) => ({ value: scope, label: scope })),
                ]}
                onChange={(next) =>
                  onChange({
                    ...filter,
                    target_type: next === ALL_TYPES ? null : next,
                  })
                }
              />
            ) : (
              scopes[0] && (
                <Badge variant="outline" color="gray">
                  {scopes[0]}
                </Badge>
              )
            )}
          </Group>
        </Group>

        <Previewed query={distribution}>
          {(data) =>
            data ? (
              <Stack gap="md" flex={1} mih={0}>
                <SimpleGrid cols={4}>
                  <Stat label="Values" value={data.count} />
                  <Stat label="Distinct" value={data.distinct_values} />
                  <Stat label="Min" value={formatValue(data.min, data.type)} />
                  <Stat label="Max" value={formatValue(data.max, data.type)} />
                </SimpleGrid>
                {data.type === "int" || data.type === "float" ? (
                  <NumberRangeView
                    data={data}
                    filter={filter}
                    onChange={onChange}
                  />
                ) : data.type === "date" ? (
                  <DateRangeView
                    data={data}
                    filter={filter}
                    onChange={onChange}
                  />
                ) : (
                  <ValuesView
                    data={data}
                    filter={filter}
                    onChange={onChange}
                    ocelId={ocelId}
                    entityType={entityType}
                    before={before}
                  />
                )}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                The attribute has no values in the log as the steps before leave
                it.
              </Text>
            )
          }
        </Previewed>
      </Stack>
    );
  },
);

export default AttributeDetail;
