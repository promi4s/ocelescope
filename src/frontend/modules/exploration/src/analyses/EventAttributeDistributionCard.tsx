import { Stack, Text } from "@mantine/core";
import { useQueryEventAttributeDistribution } from "../api/exploration";
import type { EventAttributeDistributionSpec } from "../model/dashboard";
import { DistributionChartCard } from "./DistributionChartCard";
import type { AnalysisCardProps } from "./types";

interface EventAttributeDistributionContentProps extends AnalysisCardProps {
  spec: EventAttributeDistributionSpec;
}

function EventAttributeDistributionContent({
  ocelId,
  spec,
  onEdit,
  onDuplicate,
  onRemove,
}: EventAttributeDistributionContentProps) {
  const result = useQueryEventAttributeDistribution(ocelId, spec.query, {
    ocel_version: "filtered",
  });
  const title = spec.title || `${spec.query.attribute} distribution`;

  const info = (
    <Stack gap="xs">
      <div>
        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
          Question
        </Text>
        <Text size="sm">
          How is {spec.query.attribute} distributed for events with activity “
          {spec.query.activity}”?
        </Text>
      </div>
      <div>
        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
          Determination
        </Text>
        <Text size="sm">
          {spec.query.grouping.kind === "bins"
            ? `Numeric values are grouped into ${spec.query.grouping.count ?? "automatically determined"} intervals.`
            : "Equal values are grouped together and counted."}
        </Text>
      </div>
      <Text size="sm">
        Missing values are included as a separate group. The active filtered
        OCEL is used.
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
      subtitle={`Activity · ${spec.query.activity}`}
      info={info}
      filenameFallback="event-attribute-distribution"
      seriesName="Events"
      populationLabel="events"
      emptyMessage="No matching events are available in the active OCEL."
      onEdit={onEdit}
      onDuplicate={onDuplicate}
      onRemove={onRemove}
    />
  );
}

export function EventAttributeDistributionCard(props: AnalysisCardProps) {
  if (props.card.spec.analysis !== "event-attribute-distribution") return null;
  return (
    <EventAttributeDistributionContent {...props} spec={props.card.spec} />
  );
}
