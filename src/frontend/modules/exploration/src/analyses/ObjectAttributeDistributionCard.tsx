import { Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { queryObjectAttributeDistribution } from "../api/querying";
import type { ObjectAttributeDistributionSpec } from "../model/dashboard";
import { DistributionChartCard } from "./DistributionChartCard";
import type { AnalysisCardProps } from "./types";

interface ObjectAttributeDistributionContentProps extends AnalysisCardProps {
  spec: ObjectAttributeDistributionSpec;
}

function ObjectAttributeDistributionContent({
  ocelId,
  spec,
  onEdit,
  onDuplicate,
  onRemove,
}: ObjectAttributeDistributionContentProps) {
  const result = useQuery({
    queryKey: [
      `/api/external/modules/querying/v1/ocels/${ocelId}/queries/object-attribute-distribution`,
      spec.query,
    ],
    queryFn: () =>
      queryObjectAttributeDistribution(ocelId, spec.query, {
        ocel_version: "filtered",
      }),
  });
  const title = spec.title || `${spec.query.attribute} distribution`;

  const info = (
    <Stack gap="xs">
      <div>
        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
          Question
        </Text>
        <Text size="sm">
          Which {spec.query.attribute} values did {spec.query.object_type}
          objects have when they participated in “{spec.query.activity}” events?
        </Text>
      </div>
      <div>
        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
          Determination
        </Text>
        <Text size="sm">
          Each unique event–object pair is counted once. The value is the latest
          object attribute value at or before the event timestamp; an initial
          object-table value is effective from 1970.
        </Text>
      </div>
      <Text size="sm">
        A change at the event timestamp already applies to that event. Missing
        values are shown separately, and the active filtered OCEL is used.
      </Text>
    </Stack>
  );

  return (
    <DistributionChartCard
      visualization={spec.visualization}
      data={result.data}
      loading={result.isPending}
      error={result.error}
      title={title}
      subtitle={`${spec.query.activity} · ${spec.query.object_type}`}
      info={info}
      filenameFallback="object-attribute-distribution"
      seriesName="Event–object pairs"
      populationLabel="event–object pairs"
      emptyMessage="No matching event–object pairs are available in the active OCEL."
      onEdit={onEdit}
      onDuplicate={onDuplicate}
      onRemove={onRemove}
    />
  );
}

export function ObjectAttributeDistributionCard(props: AnalysisCardProps) {
  if (props.card.spec.analysis !== "object-attribute-distribution") return null;
  return (
    <ObjectAttributeDistributionContent {...props} spec={props.card.spec} />
  );
}
