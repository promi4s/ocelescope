import {
  Button,
  Center,
  Group,
  Loader,
  Select,
  Stack,
  Title,
} from "@mantine/core";
import {
  useE2o,
  useE2oCountDistribution,
  useO2o,
  useO2oCountDistribution,
} from "@ocelescope/api-base";
import { type RangeValue, viewParams } from "@ocelescope/core";
import { keepPreviousData } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import type { ReactNode } from "react";
import CountRange from "./CountRange";

const ANY_QUALIFIER = "__any__";
const BINS = 40;

export type RelationDetailProps = {
  ocelId: string;
  viewId: string | null;
  kind: "e2o" | "o2o";
  source: string;
  target: string;
  qualifier: string | null;
  direction: "source" | "target";
  range: [number | null, number | null];
  countedLabel: string;
  caption: string;
  exclude?: boolean;
  onQualifierChange: (qualifier: string | null) => void;
  onRangeChange: (range: RangeValue) => void;
  onClear: () => void;
  children?: ReactNode;
};

const RelationDetail: React.FC<RelationDetailProps> = ({
  ocelId,
  viewId,
  kind,
  source,
  target,
  qualifier,
  direction,
  range,
  countedLabel,
  caption,
  exclude,
  onQualifierChange,
  onRangeChange,
  onClear,
  children,
}) => {
  const view = viewParams(viewId);
  const options = { query: { placeholderData: keepPreviousData } };
  const useRelations = kind === "e2o" ? useE2o : useO2o;
  const useDistribution =
    kind === "e2o" ? useE2oCountDistribution : useO2oCountDistribution;

  const relations = useRelations(
    ocelId,
    {
      ...view,
      with_qualifier: false,
      source_types: [source],
      target_types: [target],
    },
    options,
  );
  const qualifiers = relations.data?.response[0]?.qualifiers ?? [];

  const distribution = useDistribution(
    ocelId,
    {
      ...view,
      source,
      target,
      direction,
      qualifier: qualifier ?? undefined,
      bins: BINS,
    },
    options,
  );

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
            {source} → {target}
          </Title>
        </Group>
        {qualifiers.length > 0 && (
          <Select
            size="xs"
            w={200}
            allowDeselect={false}
            value={qualifier ?? ANY_QUALIFIER}
            data={[
              { value: ANY_QUALIFIER, label: "Any qualifier" },
              ...qualifiers.map((name) => ({ value: name, label: name })),
            ]}
            onChange={(next) =>
              onQualifierChange(next === ANY_QUALIFIER ? null : next)
            }
          />
        )}
      </Group>

      {children && (
        <Group gap="sm" wrap="nowrap">
          {children}
        </Group>
      )}

      {distribution.data === undefined ? (
        <Center flex={1} mih={120}>
          <Loader size="sm" />
        </Center>
      ) : (
        <CountRange
          data={distribution.data}
          value={range}
          onChange={onRangeChange}
          countedLabel={countedLabel}
          caption={caption}
          exclude={exclude}
        />
      )}
    </Stack>
  );
};

export default RelationDetail;
