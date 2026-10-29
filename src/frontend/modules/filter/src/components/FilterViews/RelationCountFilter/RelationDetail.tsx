import {
  Button,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import type { RelationCountDistribution } from "@ocelescope/api-base";
import { keepPreviousData } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { useMemo } from "react";
import { useView } from "../../../hooks/useView";
import Previewed from "../../Previewed";
import RangeView, { type Bin, type Range } from "../../RangeView";
import type { RelationViewProps } from "./util";

const ANY_QUALIFIER = "__any__";
const BINS = 40;

const formatCount = (value: number) => value.toLocaleString();

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <Stack gap={0} miw={0}>
    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
      {label}
    </Text>
    <Text size="sm" fw={500}>
      {value.toLocaleString()}
    </Text>
  </Stack>
);

const RelationDetail: React.FC<RelationViewProps & { onClear: () => void }> = ({
  ocelId,
  kind,
  hooks,
  filter,
  onChange,
  before,
  onClear,
}) => {
  const direction = filter.direction ?? "source";
  const view = useView(ocelId, before);

  const options = {
    query: { enabled: view !== undefined, placeholderData: keepPreviousData },
  };

  const relations = hooks.useRelations(
    ocelId,
    {
      ...view,
      with_qualifier: false,
      source_types: [filter.source],
      target_types: [filter.target],
    },
    options,
  );
  const qualifiers = relations.data?.response[0]?.qualifiers ?? [];

  const distribution = hooks.useDistribution(
    ocelId,
    {
      ...view,
      source: filter.source,
      target: filter.target,
      direction,
      qualifier: filter.qualifier ?? undefined,
      bins: BINS,
    },
    options,
  );

  const sides =
    kind === "e2o"
      ? { source: "event", target: "object" }
      : { source: filter.source, target: filter.target };
  const isSource = direction === "source";
  const countedNoun = kind === "e2o" && isSource ? "event" : "object";
  const relatedNoun = kind === "e2o" && !isSource ? "events" : "objects";
  const caption = `How many ${isSource ? filter.target : filter.source} ${relatedNoun} each ${isSource ? filter.source : filter.target} ${countedNoun} is related to`;

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
            Change relation
          </Button>
          <Title order={5} style={{ overflowWrap: "anywhere" }}>
            {filter.source} → {filter.target}
          </Title>
        </Group>
        <Group gap="sm" wrap="nowrap">
          <SegmentedControl
            size="xs"
            value={direction}
            data={[
              { label: `Per ${sides.source}`, value: "source" },
              { label: `Per ${sides.target}`, value: "target" },
            ]}
            onChange={(next) =>
              onChange({
                ...filter,
                direction: next as "source" | "target",
                range: [null, null],
              })
            }
          />
          {qualifiers.length > 0 && (
            <Select
              size="xs"
              w={200}
              allowDeselect={false}
              value={filter.qualifier ?? ANY_QUALIFIER}
              data={[
                { value: ANY_QUALIFIER, label: "Any qualifier" },
                ...qualifiers.map((qualifier) => ({
                  value: qualifier,
                  label: qualifier,
                })),
              ]}
              onChange={(next) =>
                onChange({
                  ...filter,
                  qualifier: next === ANY_QUALIFIER ? null : next,
                })
              }
            />
          )}
        </Group>
      </Group>

      <Previewed query={distribution}>
        {(data) => (
          <CountRange
            data={data}
            filter={filter}
            onChange={onChange}
            countedLabel={countedNoun === "event" ? "Events" : "Objects"}
            caption={caption}
          />
        )}
      </Previewed>
    </Stack>
  );
};

type CountRangeProps = Pick<RelationViewProps, "filter" | "onChange"> & {
  data: RelationCountDistribution;
  countedLabel: string;
  caption: string;
};

const CountRange: React.FC<CountRangeProps> = ({
  data,
  filter,
  onChange,
  countedLabel,
  caption,
}) => {
  const bins = useMemo<Bin[]>(
    () =>
      data.bins.map(({ start, end, count }, index, all) => ({
        start: Number(start),
        end: index < all.length - 1 ? Number(end) - 1 : Number(end),
        count,
      })),
    [data.bins],
  );

  const [low, high] = filter.range;
  const value: Range = [low ?? data.min, high ?? data.max];
  const setRange = (range: Range) => onChange({ ...filter, range });

  return (
    <Stack gap="md">
      <SimpleGrid cols={4}>
        <Stat label={countedLabel} value={data.entities} />
        <Stat label="Relations" value={data.relations} />
        <Stat label="Min" value={data.min} />
        <Stat label="Max" value={data.max} />
      </SimpleGrid>
      <Text size="sm" c="dimmed">
        {caption}
      </Text>
      <RangeView
        bins={bins}
        min={data.min}
        max={data.max}
        value={value}
        onChange={setRange}
        format={formatCount}
        snap={Math.round}
        inputs={
          <Group wrap="nowrap" align="end" gap="xs">
            <NumberInput
              flex={1}
              value={value[0]}
              min={data.min}
              max={value[1]}
              allowDecimal={false}
              onChange={(next) =>
                setRange([typeof next === "number" ? next : data.min, value[1]])
              }
            />
            <Text c="dimmed" size="sm" pb={8}>
              -
            </Text>
            <NumberInput
              flex={1}
              value={value[1]}
              min={value[0]}
              max={data.max}
              allowDecimal={false}
              onChange={(next) =>
                setRange([value[0], typeof next === "number" ? next : data.max])
              }
            />
          </Group>
        }
      />
    </Stack>
  );
};

export default RelationDetail;
